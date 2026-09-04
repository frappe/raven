import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadSites, normalizeSiteUrl, removeSite, saveSite, validateSite, nativeGetJson } from "./sites"

const { CapacitorHttp, syncAllowedOrigins, prefs, signOut, unsubscribeSitePush } = vi.hoisted(() => ({
    CapacitorHttp: { get: vi.fn() },
    syncAllowedOrigins: vi.fn(async () => { }),
    prefs: new Map<string, string>(),
    signOut: vi.fn(async () => { }),
    unsubscribeSitePush: vi.fn(async () => { }),
}))
vi.mock("@capacitor/core", () => ({ CapacitorHttp, registerPlugin: () => ({ syncAllowedOrigins }) }))
vi.mock("./auth", () => ({ signOut }))
vi.mock("./push", () => ({ unsubscribeSitePush }))
vi.mock("@capacitor/preferences", () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value) },
        remove: async ({ key }: { key: string }) => { prefs.delete(key) },
    },
}))

describe("saveSite / removeSite", () => {
    beforeEach(() => { prefs.clear(); syncAllowedOrigins.mockClear() })

    it("moves the saved site to the front and resyncs the shell's allowed origins", async () => {
        await saveSite({ url: "https://a.com", name: "A" })
        await saveSite({ url: "https://b.com", name: "B" })
        await saveSite({ url: "https://a.com", name: "A2" })
        expect((await loadSites()).map((s) => s.url)).toEqual(["https://a.com", "https://b.com"])
        expect(syncAllowedOrigins).toHaveBeenCalledTimes(3)
    })
    it("resyncs allowed origins after a removal", async () => {
        await saveSite({ url: "https://a.com", name: "A" })
        syncAllowedOrigins.mockClear()
        await removeSite("https://a.com")
        expect(await loadSites()).toEqual([])
        expect(syncAllowedOrigins).toHaveBeenCalledTimes(1)
    })
    it("stops the removed site's pushes, then revokes its tokens", async () => {
        await saveSite({ url: "https://a.com", name: "A" })
        signOut.mockClear(); unsubscribeSitePush.mockClear()
        await removeSite("https://a.com")
        expect(unsubscribeSitePush).toHaveBeenCalledWith("https://a.com")
        expect(signOut).toHaveBeenCalledWith("https://a.com")
        expect(unsubscribeSitePush.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0])
    })
    it("still saves when the shell plugin is unavailable", async () => {
        syncAllowedOrigins.mockRejectedValueOnce(new Error("not implemented"))
        await saveSite({ url: "https://a.com", name: "A" })
        expect((await loadSites()).map((s) => s.url)).toEqual(["https://a.com"])
    })
})

describe("normalizeSiteUrl", () => {
    it("adds https and strips path/trailing slash", () => {
        expect(normalizeSiteUrl(" raven.example.com/raven/ ")).toBe("https://raven.example.com")
    })
    it("keeps explicit http", () => {
        expect(normalizeSiteUrl("http://localhost:8000")).toBe("http://localhost:8000")
        expect(normalizeSiteUrl("http://ravenserver")).toBe("http://ravenserver")
    })
    it("returns null for garbage", () => {
        expect(normalizeSiteUrl("not a url")).toBeNull()
        expect(normalizeSiteUrl("")).toBeNull()
    })
})

describe("nativeGetJson", () => {
    it("wraps CapacitorHttp.get into ok + json + final url with 8 s timeouts", async () => {
        CapacitorHttp.get.mockResolvedValue({ status: 200, data: { message: { app_name: "X" } }, url: "https://www.a.com/api" })
        const res = await nativeGetJson("https://a.com/api")
        expect(CapacitorHttp.get).toHaveBeenCalledWith({ url: "https://a.com/api", connectTimeout: 8000, readTimeout: 8000 })
        expect(res.ok).toBe(true)
        expect(res.url).toBe("https://www.a.com/api")
        expect(await res.json()).toEqual({ message: { app_name: "X" } })
    })
    it("maps non-2xx statuses to ok: false", async () => {
        CapacitorHttp.get.mockResolvedValue({ status: 500, data: null })
        expect((await nativeGetJson("https://a.com/api")).ok).toBe(false)
    })
})

describe("validateSite", () => {
    it("returns app name and client id on 200", async () => {
        const getJson = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { app_name: "Acme Chat" } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { client_id: "CID", native_login: true, app_name: "Acme", logo: "/logo.png" } }) })
        expect(await validateSite("https://a.com", getJson)).toEqual({ url: "https://a.com", name: "Acme", clientId: "CID", logo: "/logo.png" })
    })
    it("reports the origin the site actually answered from after a redirect", async () => {
        const getJson = vi.fn()
            .mockResolvedValueOnce({ ok: true, url: "https://www.a.com/api/method/raven.api.login.get_context", json: async () => ({ message: { app_name: "Acme" } }) })
            .mockRejectedValueOnce(new Error("x"))
        expect((await validateSite("https://a.com", getJson))?.url).toBe("https://www.a.com")
        // The second probe goes to the resolved origin so its client id belongs to the same site.
        expect(getJson).toHaveBeenLastCalledWith("https://www.a.com/api/method/raven.api.raven_mobile.get_client_id")
    })
    it("ignores the client id on sites too old for native login", async () => {
        const getJson = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { app_name: "Acme Chat" } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { client_id: "CID", app_name: "Acme" } }) })
        expect(await validateSite("https://a.com", getJson)).toEqual({ url: "https://a.com", name: "Acme" })
        expect(getJson).toHaveBeenCalledWith(expect.stringContaining("/api/method/raven.api.login.get_context"))
        expect(getJson).toHaveBeenCalledWith(expect.stringContaining("/api/method/raven.api.raven_mobile.get_client_id"))
    })
    it("returns app name with undefined client id when the second call fails", async () => {
        const getJson = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { app_name: "Acme Chat" } }) })
            .mockRejectedValueOnce(new Error("x"))
        expect(await validateSite("https://a.com", getJson)).toEqual({ url: "https://a.com", name: "Acme Chat" })
    })
    it("returns null on non-200 or network error", async () => {
        expect(await validateSite("https://a.com", vi.fn().mockResolvedValue({ ok: false }))).toBeNull()
        expect(await validateSite("https://a.com", vi.fn().mockRejectedValue(new Error("x")))).toBeNull()
    })
})
