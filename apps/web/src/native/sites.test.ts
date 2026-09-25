import { beforeEach, describe, expect, it, vi } from "vitest"
import { completeSite, forgetSite, getDefaultSite, loadSites, normalizeSiteUrl, probeSite, refreshSite, saveSite, setDefaultSite, wipeSiteData, type Site } from "./sites"

const { prefs } = vi.hoisted(() => ({ prefs: new Map<string, string>() }))
vi.mock("@capacitor/preferences", () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value) },
        remove: async ({ key }: { key: string }) => { prefs.delete(key) },
        // Like the native proxy: any unknown property is a plugin method, `then` included.
        then: () => { throw new Error("Preferences.then() is not implemented") },
    },
}))

const clearMediaCache = vi.hoisted(() => vi.fn(async () => { }))
vi.mock("./download", () => ({ clearMediaCache }))

const site = (url: string, name = "A"): Site => ({ url, name, sitename: "a.com", clientId: "C", ravenVersion: "3.0.0" })

describe("saved sites", () => {
    beforeEach(() => prefs.clear())
    it("moves a saved site to the front", async () => {
        await saveSite(site("https://a.com"))
        await saveSite(site("https://b.com", "B"))
        await saveSite(site("https://a.com", "A2"))
        expect((await loadSites()).map((s) => [s.url, s.name])).toEqual([["https://a.com", "A2"], ["https://b.com", "B"]])
    })
    it("forgets a site and clears it as the default", async () => {
        await saveSite(site("https://a.com"))
        await setDefaultSite("https://a.com")
        await forgetSite("https://a.com")
        expect(await loadSites()).toEqual([])
        expect(await getDefaultSite()).toBeNull()
    })
    it("keeps another default when forgetting a different site", async () => {
        await saveSite(site("https://a.com"))
        await saveSite(site("https://b.com"))
        await setDefaultSite("https://b.com")
        await forgetSite("https://a.com")
        expect(await getDefaultSite()).toBe("https://b.com")
    })
})

describe("normalizeSiteUrl", () => {
    it("adds https and strips path and trailing slash", () => {
        expect(normalizeSiteUrl(" raven.example.com/raven/ ")).toBe("https://raven.example.com")
    })
    it("keeps explicit http and lowercases the host", () => {
        expect(normalizeSiteUrl("http://LocalHost:8000")).toBe("http://localhost:8000")
    })
    it("defaults loopback and private hosts to http, public ones to https", () => {
        expect(normalizeSiteUrl("127.0.0.1:8004")).toBe("http://127.0.0.1:8004")
        expect(normalizeSiteUrl("192.168.0.112:8004")).toBe("http://192.168.0.112:8004")
        expect(normalizeSiteUrl("localhost")).toBe("http://localhost")
        expect(normalizeSiteUrl("raven.test")).toBe("https://raven.test")
        expect(normalizeSiteUrl("https://127.0.0.1")).toBe("https://127.0.0.1")
    })
    it("returns null for garbage", () => {
        expect(normalizeSiteUrl("not a url")).toBeNull()
        expect(normalizeSiteUrl("")).toBeNull()
    })
})

describe("probeSite", () => {
    const answer = (message: Record<string, unknown>, status = 200, url?: string) =>
        vi.fn(async () => ({ status, data: status === 200 ? { message } : {}, url }))
    const good = { client_id: "C", raven_version: "3.0.0", min_app_version: "2.0.0", sitename: "a.com", app_name: "Acme", logo: "/files/logo.png" }

    it("returns the site from its client info, on the origin the site answered from", async () => {
        const getJson = answer(good, 200, "https://www.a.com/api/method/raven.api.raven_mobile.get_client_id")
        const result = await probeSite("https://a.com", getJson)
        expect(result).toEqual({ site: { url: "https://www.a.com", name: "Acme", sitename: "a.com", clientId: "C", logo: "/files/logo.png", ravenVersion: "3.0.0", minAppVersion: "2.0.0" } })
        expect(getJson).toHaveBeenCalledWith("https://a.com/api/method/raven.api.raven_mobile.get_client_id")
    })
    it("reports a site without the mobile API as too old", async () => {
        expect(await probeSite("https://old.com", vi.fn(async () => ({ status: 404, data: null })))).toEqual({ error: "site-too-old" })
    })
    it("reports a non-Raven answer", async () => {
        expect(await probeSite("https://a.com", vi.fn(async () => ({ status: 200, data: "<html>" })))).toEqual({ error: "not-raven" })
    })
    it("reports an unreachable host", async () => {
        expect(await probeSite("https://a.com", vi.fn(async () => { throw new Error("timeout") }))).toEqual({ error: "unreachable" })
    })
    it("keeps min_app_version on the site instead of blocking", async () => {
        const result = await probeSite("https://a.com", answer({ ...good, min_app_version: "9.0.0" }))
        expect("site" in result && result.site.minAppVersion).toBe("9.0.0")
    })
    it("reports a site without a usable OAuth client", async () => {
        expect(await probeSite("https://a.com", answer({ ...good, client_id: null }))).toEqual({ error: "no-client" })
    })
})

describe("refreshSite", () => {
    beforeEach(() => prefs.clear())
    it("saves the probed logo, name and version onto the record", async () => {
        const old = site("https://a.com")
        await saveSite(old)
        const getJson = async () => ({ status: 200, data: { message: { client_id: "C", raven_version: "3.1.0", sitename: "a.com", app_name: "Acme", logo: "/assets/raven/raven_logo.svg" } } })
        await refreshSite(old, getJson)
        expect((await loadSites())[0]).toMatchObject({ url: "https://a.com", name: "Acme", logo: "/assets/raven/raven_logo.svg", ravenVersion: "3.1.0" })
    })
})

describe("completeSite", () => {
    const clientInfo = (url: string) => async () => ({ status: 200, url: `${url}/api/method/raven.api.raven_mobile.get_client_id`, data: { message: { sitename: "a.com", raven_version: "3.0.0", client_id: "C", app_name: "A" } } })

    it("forgets the old entry and its default when the site now answers from another origin", async () => {
        prefs.clear()
        const old = { url: "https://a.com", name: "A" } as Site
        await saveSite(old)
        await setDefaultSite(old.url)
        const result = await completeSite(old, clientInfo("https://www.a.com"))
        expect("site" in result && result.site.url).toBe("https://www.a.com")
        expect((await loadSites()).map((s) => s.url)).toEqual([])
        expect(await getDefaultSite()).toBeNull()
    })
    it("leaves the entry alone when the origin is unchanged or the probe fails", async () => {
        prefs.clear()
        const old = { url: "https://a.com", name: "A" } as Site
        await saveSite(old)
        await completeSite(old, clientInfo("https://a.com"))
        await completeSite(old, async () => { throw new Error("offline") })
        expect((await loadSites()).map((s) => s.url)).toEqual(["https://a.com"])
    })
})

describe("wipeSiteData", () => {
    it("removes that site's scoped keys and database, and nothing of another site", async () => {
        const store = new Map([["https://a.com|raven-boot-cache", "1"], ["https://a.com|app-cache", "2"], ["https://a.company.com|raven-draft", "3"], ["raven-theme", "dark"]])
        const local = { removeItem: (key: string) => { store.delete(key) } }
        vi.stubGlobal("localStorage", new Proxy(local, { ownKeys: () => [...store.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }))
        const deleteDatabase = vi.fn()
        vi.stubGlobal("indexedDB", { deleteDatabase })
        await wipeSiteData("https://a.com")
        expect([...store.keys()]).toEqual(["https://a.company.com|raven-draft", "raven-theme"])
        expect(deleteDatabase).toHaveBeenCalledWith("https://a.com|RavenDB")
        expect(clearMediaCache).toHaveBeenCalled()
        vi.unstubAllGlobals()
    })
})
