import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, string>()
let hidden = false
const listeners = new Set<() => void>()

beforeEach(() => {
    vi.useFakeTimers()
    store.clear()
    hidden = false
    listeners.clear()
    vi.stubGlobal("localStorage", {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
    })
    vi.stubGlobal("document", {
        get hidden() { return hidden },
        addEventListener: (_: string, fn: () => void) => { listeners.add(fn) },
        removeEventListener: (_: string, fn: () => void) => { listeners.delete(fn) },
    })
    vi.stubGlobal("location", { href: "https://a.com/raven/ws/general" })
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 16)", platform: "Linux", maxTouchPoints: 5 })
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) })
    vi.resetModules()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const load = () => import("./openInApp")
const hide = () => { hidden = true; listeners.forEach((fn) => fn()) }

describe("openInApp", () => {
    it("hands the page to the app as a raven://open link", async () => {
        const { openInApp } = await load()
        openInApp()
        expect(location.href).toBe(`raven://open?url=${encodeURIComponent("https://a.com/raven/ws/general")}`)
    })
    it("remembers the app once it takes over", async () => {
        const { openInApp, wantsApp } = await load()
        openInApp()
        hide()
        expect(wantsApp()).toBe(true)
    })
    it("forgets the app when it doesn't open, and remembers it if it opens later", async () => {
        store.set("raven-open-in-app", "1")
        const { openInApp, wantsApp } = await load()
        openInApp()
        vi.advanceTimersByTime(3000)
        expect(wantsApp()).toBe(false)
        hide()
        expect(wantsApp()).toBe(true)
    })
    it("ignores the page hiding long after, when it can't be the app opening", async () => {
        const { openInApp, wantsApp } = await load()
        openInApp()
        vi.advanceTimersByTime(60_000)
        hide()
        expect(wantsApp()).toBe(false)
    })
    it("on Android, a tap opens the app or else its Play Store page", async () => {
        const { openInApp } = await load()
        openInApp({ orStore: true })
        expect(location.href).toMatch(/^intent:\/\/open\?url=.+#Intent;scheme=raven;package=raven\.thecommit\.company;S\.browser_fallback_url=https%3A%2F%2Fplay\.google\.com%2F.+;end$/)
    })
    it("leaves iPhone Safari to its own Smart App Banner", async () => {
        const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        vi.stubGlobal("navigator", { userAgent: iphone, platform: "iPhone", maxTouchPoints: 5 })
        expect((await load()).offersApp()).toBe(false)
        vi.resetModules()
        vi.stubGlobal("navigator", { userAgent: iphone.replace("Version/18.0", "CriOS/130.0"), platform: "iPhone", maxTouchPoints: 5 })
        expect((await load()).offersApp()).toBe(true)
    })
    it("offers the app on a phone browser until it's chosen or dismissed", async () => {
        const { offersApp, dismissApp } = await load()
        expect(offersApp()).toBe(true)
        dismissApp()
        expect(offersApp()).toBe(false)
    })
    it("never offers it on a desktop or in the installed web app", async () => {
        vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 })
        expect((await load()).offersApp()).toBe(false)
        vi.resetModules()
        vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone)", platform: "iPhone", maxTouchPoints: 5 })
        vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) })
        expect((await load()).offersApp()).toBe(false)
    })
})
