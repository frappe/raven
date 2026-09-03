import { describe, expect, it, vi } from "vitest"
import { normalizeSiteUrl, validateSite, nativeGetJson } from "./sites"

const { CapacitorHttp } = vi.hoisted(() => ({ CapacitorHttp: { get: vi.fn() } }))
vi.mock("@capacitor/core", () => ({ CapacitorHttp }))

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
    it("wraps CapacitorHttp.get into ok + json with 8 s timeouts", async () => {
        CapacitorHttp.get.mockResolvedValue({ status: 200, data: { message: { app_name: "X" } } })
        const res = await nativeGetJson("https://a.com/api")
        expect(CapacitorHttp.get).toHaveBeenCalledWith({ url: "https://a.com/api", connectTimeout: 8000, readTimeout: 8000 })
        expect(res.ok).toBe(true)
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
        expect(await validateSite("https://a.com", getJson)).toEqual({ name: "Acme", clientId: "CID", logo: "/logo.png" })
    })
    it("ignores the client id on sites too old for native login", async () => {
        const getJson = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { app_name: "Acme Chat" } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { client_id: "CID", app_name: "Acme" } }) })
        expect(await validateSite("https://a.com", getJson)).toEqual({ name: "Acme" })
        expect(getJson).toHaveBeenCalledWith(expect.stringContaining("/api/method/raven.api.login.get_context"))
        expect(getJson).toHaveBeenCalledWith(expect.stringContaining("/api/method/raven.api.raven_mobile.get_client_id"))
    })
    it("returns app name with undefined client id when the second call fails", async () => {
        const getJson = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { app_name: "Acme Chat" } }) })
            .mockRejectedValueOnce(new Error("x"))
        expect(await validateSite("https://a.com", getJson)).toEqual({ name: "Acme Chat" })
    })
    it("returns null on non-200 or network error", async () => {
        expect(await validateSite("https://a.com", vi.fn().mockResolvedValue({ ok: false }))).toBeNull()
        expect(await validateSite("https://a.com", vi.fn().mockRejectedValue(new Error("x")))).toBeNull()
    })
})
