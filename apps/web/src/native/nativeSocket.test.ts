import { describe, expect, it, vi } from "vitest"
import { NativeSocket, type RavenSocketPlugin } from "./nativeSocket"

vi.mock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: async () => { } }) } }))

const makePlugin = () => {
    const listeners = new Map<string, (payload: { event?: string; args?: unknown[] }) => void>()
    const plugin = {
        connect: vi.fn(async () => { }),
        disconnect: vi.fn(async () => { }),
        emit: vi.fn(async () => { }),
        setToken: vi.fn(async () => { }),
        addListener: vi.fn(async (name: string, handler) => { listeners.set(name, handler); return { remove: async () => { } } }),
        // Like the native proxy: any unknown property is a plugin method, `then` included.
        then: () => { throw new Error("RavenSocket.then() is not implemented") },
    } as unknown as RavenSocketPlugin & { then: () => never }
    return { plugin, fire: (name: string, payload = {}) => listeners.get(name)?.(payload) }
}

const target = { url: "https://a.com", namespace: "a.com", origin: "https://a.com" }

const make = async () => {
    const { plugin, fire } = makePlugin()
    const socket = new NativeSocket(target, () => "AT", async () => ({ plugin }))
    await socket.start()
    return { socket, plugin, fire }
}

describe("NativeSocket", () => {
    it("connects with the site as origin and the bearer token", async () => {
        const { plugin } = await make()
        expect(plugin.connect).toHaveBeenCalledWith({ ...target, token: "AT" })
    })
    it("delivers server events with their arguments and removes one handler on off", async () => {
        const { socket, fire } = await make()
        const a = vi.fn(), b = vi.fn()
        socket.on("raven:new_message", a).on("raven:new_message", b)
        fire("event", { event: "raven:new_message", args: [{ channel_id: "c" }, "x"] })
        expect(a).toHaveBeenCalledWith({ channel_id: "c" }, "x")
        socket.off("raven:new_message", a)
        fire("event", { event: "raven:new_message", args: [1] })
        expect(a).toHaveBeenCalledTimes(1)
        expect(b).toHaveBeenCalledTimes(2)
    })
    it("tracks connected and reports connect and disconnect", async () => {
        const { socket, fire } = await make()
        const onConnect = vi.fn()
        socket.on("connect", onConnect)
        expect(socket.connected).toBe(false)
        fire("connect")
        expect(socket.connected).toBe(true)
        expect(onConnect).toHaveBeenCalledTimes(1)
        fire("disconnect")
        expect(socket.connected).toBe(false)
    })
    it("reports reconnect on the manager only", async () => {
        const { socket, fire } = await make()
        const manager = vi.fn(), plain = vi.fn()
        socket.io.on("reconnect", manager)
        socket.on("reconnect", plain)
        fire("reconnect")
        expect(manager).toHaveBeenCalledTimes(1)
        expect(plain).not.toHaveBeenCalled()
        socket.io.off("reconnect", manager)
        fire("reconnect")
        expect(manager).toHaveBeenCalledTimes(1)
    })
    it("forwards emit, setToken, and connect to the plugin", async () => {
        const { socket, plugin, fire } = await make()
        fire("connect")
        socket.emit("doc_subscribe", "Raven Channel", "c1")
        socket.setToken("AT2")
        socket.connect()
        await vi.waitFor(() => expect(plugin.setToken).toHaveBeenCalledWith({ token: "AT2" }))
        expect(plugin.emit).toHaveBeenCalledWith({ event: "doc_subscribe", args: ["Raven Channel", "c1"] })
        expect(plugin.connect).toHaveBeenCalledTimes(2)
    })
    it("buffers emits until connected, then flushes them in order before the connect handlers", async () => {
        const { socket, plugin, fire } = await make()
        const order: string[] = []
        plugin.emit = vi.fn(async ({ event }) => { order.push(event) })
        socket.on("connect", () => order.push("connect"))
        socket.emit("doc_subscribe", "Raven Channel", "c1").emit("doc_open", "Raven Channel", "c1")
        await Promise.resolve()
        expect(plugin.emit).not.toHaveBeenCalled()
        fire("connect")
        expect(order).toEqual(["doc_subscribe", "doc_open", "connect"])
        fire("disconnect")
        socket.emit("late")
        await Promise.resolve()
        expect(order).toEqual(["doc_subscribe", "doc_open", "connect"])
    })
    it("re-dials with the new token when setToken arrives on a dead socket", async () => {
        const { socket, plugin, fire } = await make()
        fire("connect")
        fire("disconnect")
        socket.setToken("AT2")
        await vi.waitFor(() => expect(plugin.connect).toHaveBeenCalledTimes(2))
        expect(plugin.connect).toHaveBeenLastCalledWith({ ...target, token: "AT2" })
    })
})
