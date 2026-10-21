import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isPrivateFile, setActiveSite, siteFetch, siteKey, siteOrigin, siteStorage, siteUrl, _resetActiveSite } from "./site"

// Store tests run in node: stub the two browser globals the module reads.
const store = new Map<string, string>()
beforeEach(() => {
    store.clear()
    ;(globalThis as any).window = { location: { origin: "http://app.test" } }
    ;(globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
    }
})
afterEach(() => { _resetActiveSite(); vi.restoreAllMocks(); delete (globalThis as any).window; delete (globalThis as any).localStorage })

describe("browser (no active site)", () => {
    it("is the identity", () => {
        expect(siteOrigin()).toBe("http://app.test")
        expect(siteUrl("/files/a.png")).toBe("/files/a.png")
        expect(siteKey("raven-draft-x")).toBe("raven-draft-x")
    })
    it("fetches with credentials", async () => {
        const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
        await siteFetch("/api/method/x", { method: "POST" })
        expect(f).toHaveBeenCalledWith("/api/method/x", { method: "POST", credentials: "include", headers: {} })
    })
})

describe("native (active site set)", () => {
    it("prefixes site-relative paths and leaves absolute ones alone", () => {
        setActiveSite("https://a.com", () => "AT")
        expect(siteOrigin()).toBe("https://a.com")
        expect(siteUrl("/files/a.png")).toBe("https://a.com/files/a.png")
        expect(siteUrl("https://x.com/b.png")).toBe("https://x.com/b.png")
        expect(siteUrl("blob:https://localhost/uuid")).toBe("blob:https://localhost/uuid")
        expect(siteUrl("data:image/png;base64,AA")).toBe("data:image/png;base64,AA")
    })
    it("scopes keys by origin", () => {
        setActiveSite("https://a.com", () => "AT")
        expect(siteKey("raven-draft-x")).toBe("https://a.com|raven-draft-x")
    })
    it("fetches with the bearer token and no cookies", async () => {
        setActiveSite("https://a.com", () => "AT")
        const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
        await siteFetch("/api/method/x", { headers: { "Content-Type": "application/json" } })
        expect(f).toHaveBeenCalledWith("https://a.com/api/method/x", { headers: { "Content-Type": "application/json", "X-Raven-App": "1", Authorization: "Bearer AT" } })
    })
    it("keeps the bearer from an absolute url on another origin", async () => {
        setActiveSite("https://a.com", () => "AT")
        const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
        await siteFetch("https://evil.example/private/files/x.png")
        await siteFetch("https://a.com.evil.example/x")
        await siteFetch("https://a.com/files/y.png")
        expect(f.mock.calls.map((c) => (c[1] as RequestInit).headers)).toEqual([{}, {}, { "X-Raven-App": "1", Authorization: "Bearer AT" }])
    })
})

describe("siteStorage", () => {
    it("reads and writes under the scoped key", () => {
        setActiveSite("https://a.com", () => "AT")
        const storage = siteStorage<string>()
        storage.setItem("k", "v")
        expect(store.get("https://a.com|k")).toBe(JSON.stringify("v"))
        expect(storage.getItem("k", "default")).toBe("v")
        storage.removeItem("k")
        expect(storage.getItem("k", "default")).toBe("default")
    })
})

describe("isPrivateFile", () => {
    it("matches the private prefix, relative or on the active site", () => {
        expect(isPrivateFile("/private/files/a.png")).toBe(true)
        expect(isPrivateFile("/files/a.png")).toBe(false)
        setActiveSite("https://a.com", () => "AT")
        expect(isPrivateFile("https://a.com/private/files/a.png")).toBe(true)
        expect(isPrivateFile("https://x.com/private/files/a.png")).toBe(false)
    })
})
