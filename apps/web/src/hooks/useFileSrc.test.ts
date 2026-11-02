import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fileSrc, sitePath } from "./useFileSrc"
import { setActiveSite, _resetActiveSite } from "@lib/site"

beforeEach(() => { ;(globalThis as any).window = { location: { origin: "http://app.test" } } })
afterEach(() => { _resetActiveSite(); vi.unstubAllEnvs(); delete (globalThis as any).window })

describe("fileSrc", () => {
    it("returns the path unchanged in the browser", () => {
        expect(fileSrc("/private/files/a.png")).toBe("/private/files/a.png")
    })
    it("routes public site files in native through the media proxy, which keeps them on disk", () => {
        vi.stubEnv("VITE_NATIVE", "1")
        setActiveSite("https://a.com", () => "AT")
        expect(fileSrc("/files/a.png")).toMatch(/^raven-media:\/\/[0-9a-z]+\/a\.png\?src=https%3A%2F%2Fa\.com%2Ffiles%2Fa\.png$/)
    })
    it("prefixes other site paths in native, and leaves other sites alone", () => {
        vi.stubEnv("VITE_NATIVE", "1")
        setActiveSite("https://a.com", () => "AT")
        expect(fileSrc("/assets/raven/a.svg")).toBe("https://a.com/assets/raven/a.svg")
        expect(fileSrc("https://b.com/files/a.png")).toBe("https://b.com/files/a.png")
    })
    it("routes private paths in native through the media proxy", () => {
        vi.stubEnv("VITE_NATIVE", "1")
        setActiveSite("https://a.com", () => "AT")
        expect(fileSrc("/private/files/a.png")).toMatch(/^raven-media:\/\/[0-9a-z]+\/a\.png\?src=/)
        ;(globalThis as any).location = { protocol: "https:", origin: "https://localhost" }
        expect(fileSrc("/private/files/a.png")).toMatch(/^https:\/\/localhost\/_raven_media_\//)
        delete (globalThis as any).location
    })
})

describe("sitePath", () => {
    const iosAddress = `raven-media://abc/a.png?src=${encodeURIComponent("https://a.com/private/files/a.png")}`
    const androidAddress = `https://localhost/_raven_media_/abc/a.png?src=${encodeURIComponent("https://a.com/private/files/a.png")}`
    it("unwraps media addresses from either platform", () => {
        setActiveSite("https://a.com", () => "AT")
        expect(sitePath(iosAddress)).toBe("/private/files/a.png")
        expect(sitePath(androidAddress)).toBe("/private/files/a.png")
    })
    it("drops the site's own origin and leaves other addresses alone", () => {
        setActiveSite("https://a.com", () => "AT")
        expect(sitePath("https://a.com/files/a.png")).toBe("/files/a.png")
        expect(sitePath("/files/a.png")).toBe("/files/a.png")
        expect(sitePath("https://b.com/a.png")).toBe("https://b.com/a.png")
    })
    it("lets the browser load an address an app build saved", () => {
        ;(globalThis as any).window = { location: { origin: "https://a.com" } }
        expect(fileSrc(androidAddress)).toBe("/private/files/a.png")
    })
})
