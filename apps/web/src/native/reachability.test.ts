import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const siteFetch = vi.fn()
const bumpConnectionEpoch = vi.fn()
vi.mock("@lib/site", () => ({ siteFetch: (...args: unknown[]) => siteFetch(...args) }))
vi.mock("@stores/connectionFreshness", () => ({ bumpConnectionEpoch: () => bumpConnectionEpoch() }))

const answer = (status: number) => ({ ok: status >= 200 && status < 300, status })
const settle = () => vi.advanceTimersByTimeAsync(0)
const OUTAGE_MS = 6000

const load = async () => ({ ...(await import("./reachability")), ...(await import("@stores/connectionState")) })

describe("reachability", () => {
    beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); siteFetch.mockReset(); bumpConnectionEpoch.mockReset() })
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

    it("reports an outage once a ping fails, and recovers with the socket", async () => {
        const { socketDown, socketUp, isOnline } = await load()
        siteFetch.mockRejectedValue(new TypeError("Load failed"))
        socketDown()
        await vi.advanceTimersByTimeAsync(OUTAGE_MS)
        expect(isOnline()).toBe(false)
        socketUp()
        expect(isOnline()).toBe(true)
        expect(bumpConnectionEpoch).toHaveBeenCalledTimes(1)
    })

    it("ignores a ping that fails after the socket is back", async () => {
        const { socketDown, socketUp, isOnline } = await load()
        let fail!: (reason: unknown) => void
        siteFetch.mockReturnValue(new Promise((_, reject) => { fail = reject }))
        socketDown()
        socketUp()
        fail(new TypeError("Load failed"))
        await vi.advanceTimersByTimeAsync(OUTAGE_MS)
        expect(isOnline()).toBe(true)
    })

    it("counts any answer short of a server error as reachable", async () => {
        const { socketDown, isOnline } = await load()
        siteFetch.mockResolvedValue(answer(401))
        socketDown()
        await vi.advanceTimersByTimeAsync(OUTAGE_MS)
        expect(isOnline()).toBe(true)
        siteFetch.mockResolvedValue(answer(503))
        await vi.advanceTimersByTimeAsync(15_000 + OUTAGE_MS)
        expect(isOnline()).toBe(false)
    })

    it("gives up on a ping the network swallows", async () => {
        const { socketDown, isOnline } = await load()
        siteFetch.mockImplementation((_path: string, init: RequestInit) => new Promise((_, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        }))
        socketDown()
        await vi.advanceTimersByTimeAsync(8000 + OUTAGE_MS)
        expect(isOnline()).toBe(false)
    })

    it("pings at once when the network returns during an outage", async () => {
        vi.stubGlobal("window", new EventTarget())
        const { socketDown } = await load()
        siteFetch.mockRejectedValue(new TypeError("Load failed"))
        socketDown()
        await settle()
        expect(siteFetch).toHaveBeenCalledTimes(1)
        window.dispatchEvent(new Event("online"))
        await settle()
        expect(siteFetch).toHaveBeenCalledTimes(2)
    })
})
