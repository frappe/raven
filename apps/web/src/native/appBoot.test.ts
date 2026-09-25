import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadBoot } from "./appBoot"

const native = vi.hoisted(() => ({ status: 0 }))
vi.mock("@capacitor/core", () => ({ CapacitorHttp: { get: async () => { if (!native.status) throw new Error("connect"); return { status: native.status, data: "" } } } }))
import { setActiveSite, siteKey, _resetActiveSite } from "@lib/site"
import { clearSessionUser, sessionUser } from "@lib/sessionUser"

const store = new Map<string, string>()
beforeEach(() => {
    store.clear()
    ;(globalThis as any).window = { location: { origin: "http://app.test" } }
    ;(globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
    }
    setActiveSite("https://a.com", () => "AT")
})
afterEach(() => { _resetActiveSite(); clearSessionUser(); vi.restoreAllMocks(); delete (globalThis as any).window; delete (globalThis as any).localStorage })

const boot = { sitename: "a.com", user: { name: "alice@x.com" }, user_info: { "alice@x.com": { fullname: "Alice", image: "/files/a.png" } }, __messages: { Hello: "Hallo" } }

describe("loadBoot", () => {
    it("fetches boot with the token, installs it, and caches it per site", async () => {
        const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: boot })))
        expect(await loadBoot()).toBe("ok")
        expect(f.mock.calls[0][0]).toBe("https://a.com/api/method/raven.api.native.boot")
        expect((f.mock.calls[0][1] as RequestInit).headers).toEqual({ "X-Raven-App": "1", Authorization: "Bearer AT" })
        expect(window.frappe.boot.sitename).toBe("a.com")
        expect(window.frappe._messages.Hello).toBe("Hallo")
        expect(sessionUser()).toEqual({ name: "alice@x.com", fullName: "Alice", image: "/files/a.png" })
        expect(JSON.parse(store.get(siteKey("raven-boot-cache"))!).sitename).toBe("a.com")
    })
    it("falls back to the cached boot when the fetch fails", async () => {
        store.set(siteKey("raven-boot-cache"), JSON.stringify(boot))
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))
        expect(await loadBoot()).toBe("ok")
        expect(window.frappe.boot.user.name).toBe("alice@x.com")
    })
    it("is offline when the request throws, nothing is cached, and the device has no network", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))
        vi.stubGlobal("navigator", { onLine: false })
        expect(await loadBoot()).toBe("offline")
        vi.unstubAllGlobals()
    })
    it("is unreachable when the request throws with the device online and native gets no answer either", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("refused"))
        vi.stubGlobal("navigator", { onLine: true })
        native.status = 0
        expect(await loadBoot()).toBe("unreachable")
        vi.unstubAllGlobals()
    })
    it("reads the status natively when the fetch fails for want of CORS headers, as a maintenance 503 does", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("cors"))
        vi.stubGlobal("navigator", { onLine: true })
        native.status = 503
        expect(await loadBoot()).toBe("maintenance")
        native.status = 401
        expect(await loadBoot()).toBe("unauthorized")
        native.status = 0
        vi.unstubAllGlobals()
    })
    it("gives up on a boot request the network swallows, and opens from the cache", async () => {
        vi.useFakeTimers()
        store.set(siteKey("raven-boot-cache"), JSON.stringify(boot))
        vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        }))
        const loading = loadBoot()
        await vi.advanceTimersByTimeAsync(8000)
        expect(await loading).toBe("ok")
        vi.useRealTimers()
    })
    it("gives up on a boot body that stalls after the headers", async () => {
        vi.useFakeTimers()
        store.set(siteKey("raven-boot-cache"), JSON.stringify(boot))
        vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => ({
            ok: true, status: 200,
            json: () => new Promise((_, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))) }),
        }) as unknown as Response)
        const loading = loadBoot()
        await vi.advanceTimersByTimeAsync(8000)
        expect(await loading).toBe("ok")
        vi.useRealTimers()
    })
    it("is unauthorized on 401 and 403, never from the cache", async () => {
        store.set(siteKey("raven-boot-cache"), JSON.stringify(boot))
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401 }))
        expect(await loadBoot()).toBe("unauthorized")
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 403 }))
        expect(await loadBoot()).toBe("unauthorized")
    })
    it("is maintenance on 503", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }))
        expect(await loadBoot()).toBe("maintenance")
    })
    it("is unavailable on any other failure", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }))
        expect(await loadBoot()).toBe("unavailable")
    })
})
