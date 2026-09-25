import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fileSrc } from "./useFileSrc"
import { setActiveSite, _resetActiveSite } from "@lib/site"

beforeEach(() => { ;(globalThis as any).window = { location: { origin: "http://app.test" } } })
afterEach(() => { _resetActiveSite(); vi.unstubAllEnvs(); delete (globalThis as any).window })

describe("fileSrc", () => {
    it("returns the path unchanged in the browser", () => {
        expect(fileSrc("/private/files/a.png")).toBe("/private/files/a.png")
    })
    it("prefixes public paths in native", () => {
        vi.stubEnv("VITE_NATIVE", "1")
        setActiveSite("https://a.com", () => "AT")
        expect(fileSrc("/files/a.png")).toBe("https://a.com/files/a.png")
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
