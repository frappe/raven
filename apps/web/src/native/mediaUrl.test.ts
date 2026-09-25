import { afterEach, describe, expect, it } from "vitest"
import { setActiveSite, _resetActiveSite } from "@lib/site"
import { mediaFolder, mediaSrc } from "./mediaUrl"

afterEach(() => _resetActiveSite())

describe("mediaSrc", () => {
    it("routes a private file through the proxy scheme with its cache folder", () => {
        setActiveSite("https://a.com", () => "AT")
        const { folder, file } = mediaFolder("https://a.com/private/files/a b.png")
        expect(file).toBe("a_b.png")
        expect(mediaSrc("https://a.com/private/files/a b.png")).toBe(`raven-media://${folder}/${file}?src=${encodeURIComponent("https://a.com/private/files/a b.png")}`)
    })
    it("uses the app origin's media path where the page is https (Android)", () => {
        setActiveSite("https://a.com", () => "AT")
        ;(globalThis as any).location = { protocol: "https:", origin: "https://localhost" }
        try { expect(mediaSrc("/private/files/x.png")).toMatch(/^https:\/\/localhost\/_raven_media_\/[0-9a-z]+\/x\.png\?src=/) } finally { delete (globalThis as any).location }
    })
    it("is the same for a site-relative and an absolute path", () => {
        setActiveSite("https://a.com", () => "AT")
        expect(mediaSrc("/private/files/x.mp4")).toBe(mediaSrc("https://a.com/private/files/x.mp4"))
    })
})
