import { afterEach, describe, expect, it, vi } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { isMapLinkOnly, mapPreviewImage, matchMapLink } from "./mapLinks"

const message = (overrides: Partial<Message> = {}): Message =>
    ({
        name: "m1",
        owner: "a@x.com",
        _liked_by: "",
        channel_id: "ch",
        creation: "",
        modified: "",
        message_type: "Text",
        text: "",
        is_reply: 0,
        is_edited: 0,
        is_forwarded: 0,
        is_thread: 0,
        is_pinned: 0,
        ...overrides,
    }) as Message

afterEach(() => vi.unstubAllGlobals())

const GOOGLE_IMAGE = "https://maps.google.com/maps/api/staticmap?center=1,2&zoom=18&size=256x160"
const APPLE_IMAGE = "https://snapshot.apple-mapkit.com/api/v1/snapshot?center=1,2"

describe("matchMapLink", () => {
    it.each([
        "https://google.com/maps/place/x",
        "https://www.google.com/maps/search/?api=1&query=1,2",
        "https://google.co.in/maps/place/x",
        "https://www.google.de/maps/place/x",
        "https://www.google.com.au/maps/place/x",
        "https://maps.google.com/?q=1,2",
        "https://maps.google.co.uk/?q=1,2",
        "https://maps.app.goo.gl/abc",
        "https://goo.gl/maps/abc",
    ])("matches Google: %s", (href) => {
        expect(matchMapLink(href)).toBe("google")
    })

    it.each(["https://maps.apple.com/?ll=1,2", "https://maps.apple/?ll=1,2"])(
        "matches Apple: %s",
        (href) => {
            expect(matchMapLink(href)).toBe("apple")
        },
    )

    it.each([
        "https://evilgoogle.com/maps/place/x",
        "https://google.com.evil.net/maps/place/x",
        "https://maps.apple.com.evil.net/?ll=1,2",
        "https://google.qz.io/maps/x",
        "https://maps.google.abc.me/x",
        "not a url",
        "ftp://google.com/maps/place/x",
    ])("rejects %s", (href) => {
        expect(matchMapLink(href)).toBeNull()
    })
})

describe("mapPreviewImage", () => {
    it("accepts a Google street-level static map", () => {
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE, image_width: 1200, image_height: 800 })).toEqual({
            url: GOOGLE_IMAGE,
            aspect: 1.5,
        })
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE.replace("maps.google.com", "maps.googleapis.com") })).toEqual({
            url: GOOGLE_IMAGE.replace("maps.google.com", "maps.googleapis.com"),
            aspect: 3 / 2,
        })
    })

    it("rejects a Google image that is not street-level", () => {
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE.replace("zoom=18", "zoom=12") })).toBeNull()
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE.replace("zoom=18", "zoom=abc") })).toBeNull()
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE.replace("zoom=18", "") })).toBeNull()
    })

    it("rejects a Google image from another host or path", () => {
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE.replace("maps.google.com", "evil.com") })).toBeNull()
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE.replace("/maps/api/staticmap", "/img") })).toBeNull()
    })

    it("accepts an Apple MapKit snapshot", () => {
        expect(mapPreviewImage("apple", { image: APPLE_IMAGE, image_width: 800, image_height: 500 })).toEqual({
            url: APPLE_IMAGE,
            aspect: 1.6,
        })
        expect(mapPreviewImage("apple", { image: APPLE_IMAGE.replace("snapshot.apple-mapkit.com", "evil.com") })).toBeNull()
    })

    it("needs an image and defaults unknown dimensions to 8:5", () => {
        expect(mapPreviewImage("google", null)).toBeNull()
        expect(mapPreviewImage("google", {})).toBeNull()
        expect(mapPreviewImage("apple", { image: APPLE_IMAGE, image_width: 0, image_height: 0 })?.aspect).toBe(3 / 2)
    })

    it("clamps extreme aspects", () => {
        expect(mapPreviewImage("apple", { image: APPLE_IMAGE, image_width: 1, image_height: 10000 })?.aspect).toBe(0.5)
        expect(mapPreviewImage("apple", { image: APPLE_IMAGE, image_width: 10000, image_height: 1 })?.aspect).toBe(2.5)
    })
})

describe("isMapLinkOnly", () => {
    const link = "https://maps.apple.com/?ll=1,2"

    it("is true for a message that is only the map link", () => {
        expect(isMapLinkOnly(message({ links: link, content: link }))).toBe(true)
    })

    it("is false when the message has words", () => {
        expect(isMapLinkOnly(message({ links: link, content: `${link} meet here` }))).toBe(false)
    })

    it("is false when previews are hidden", () => {
        expect(isMapLinkOnly(message({ links: link, content: link, hide_link_preview: 1 }))).toBe(false)
    })

    it("is false for a non-map link", () => {
        expect(isMapLinkOnly(message({ links: "https://example.com", content: "https://example.com" }))).toBe(false)
    })

    it("is false when the message also carries an inline image", () => {
        expect(
            isMapLinkOnly(
                message({ links: link, content: link, text: `<p><a href="${link}">${link}</a></p><p><img src="gif"></p>` }),
            ),
        ).toBe(false)
    })

    it("is false when the map domain is blocked", async () => {
        vi.stubGlobal("window", { frappe: { boot: { link_preview_blocked_domains: ["apple.com"] } } })
        vi.resetModules()
        const fresh = await import("./mapLinks")
        expect(fresh.isMapLinkOnly(message({ links: link, content: link }))).toBe(false)
    })
})
