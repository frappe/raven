import { describe, expect, it } from "vitest"
import { mapLinkDetails, mapPreviewImage, matchMapLink } from "./mapLinks"

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

const GOOGLE_PLACE =
    "https://www.google.com/maps/place/Neelkanth+Corporate+IT+Park/@19.0822784,72.8955153,17z/data=!3m1"
const APPLE_PLACE =
    "https://maps.apple.com/place?address=Baba+Jamsandekar+Marg%2C+Mumbai&coordinate=18.996882%2C72.827781&name=Lodha+Vista"

describe("mapLinkDetails", () => {
    it("reads a Google place name and its @ coordinates", () => {
        expect(mapLinkDetails(GOOGLE_PLACE, "google")).toEqual({
            name: "Neelkanth Corporate IT Park",
            address: null,
            coordinates: { latitude: 19.0822784, longitude: 72.8955153 },
        })
    })

    it("reads Google coordinates from the query", () => {
        expect(
            mapLinkDetails("https://www.google.com/maps/search/?api=1&query=19.079944,72.895628", "google"),
        ).toEqual({
            name: null,
            address: null,
            coordinates: { latitude: 19.079944, longitude: 72.895628 },
        })
    })

    it("reads a Google query name when it is not a coordinate pair", () => {
        expect(mapLinkDetails("https://www.google.com/maps/search/?api=1&query=Some+Cafe", "google")).toEqual({
            name: "Some Cafe",
            address: null,
            coordinates: null,
        })
    })

    it("has nothing for a Google short link", () => {
        expect(mapLinkDetails("https://maps.app.goo.gl/xyz", "google")).toEqual({
            name: null,
            address: null,
            coordinates: null,
        })
    })

    it("reads an Apple place name, address and coordinate", () => {
        expect(mapLinkDetails(APPLE_PLACE, "apple")).toEqual({
            name: "Lodha Vista",
            address: "Baba Jamsandekar Marg, Mumbai",
            coordinates: { latitude: 18.996882, longitude: 72.827781 },
        })
    })

    it("reads Apple's q and ll", () => {
        expect(mapLinkDetails("https://maps.apple.com/?ll=19.07,72.89&q=Location", "apple")).toEqual({
            name: "Location",
            address: null,
            coordinates: { latitude: 19.07, longitude: 72.89 },
        })
    })

    it("falls back to Apple's fetched title", () => {
        expect(mapLinkDetails("https://maps.apple/p/abc", "apple", "Lodha Vista")).toEqual({
            name: "Lodha Vista",
            address: null,
            coordinates: null,
        })
    })

    it("rejects out-of-range coordinates", () => {
        expect(mapLinkDetails("https://www.google.com/maps/place/X/@91,0,17z", "google").coordinates).toBeNull()
        expect(mapLinkDetails("https://maps.apple.com/place?coordinate=91,0", "apple").coordinates).toBeNull()
    })

    it("does not use an out-of-range coordinate-looking q as a name", () => {
        expect(mapLinkDetails("https://www.google.com/maps/search/?api=1&query=100,200", "google").name).toBeNull()
    })

    it("collapses whitespace and caps text at 200 characters", () => {
        expect(mapLinkDetails("https://www.google.com/maps/search/?api=1&query=Some+++Cafe", "google").name).toBe(
            "Some Cafe",
        )
        expect(
            mapLinkDetails(`https://www.google.com/maps/search/?api=1&query=${"a".repeat(500)}`, "google").name,
        ).toHaveLength(200)
    })
})

const GOOGLE_IMAGE = "https://maps.google.com/maps/api/staticmap?center=1,2&zoom=18&size=240x160"
const APPLE_IMAGE = "https://snapshot.apple-mapkit.com/api/v1/snapshot?center=1,2"

describe("mapPreviewImage", () => {
    it("accepts Google street-level static maps", () => {
        expect(mapPreviewImage("google", { image: GOOGLE_IMAGE })).toBe(GOOGLE_IMAGE)
        expect(
            mapPreviewImage("google", { image: GOOGLE_IMAGE.replace("maps.google.com", "maps.googleapis.com") }),
        ).toBe(GOOGLE_IMAGE.replace("maps.google.com", "maps.googleapis.com"))
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

    it("accepts an Apple MapKit snapshot only", () => {
        expect(mapPreviewImage("apple", { image: APPLE_IMAGE })).toBe(APPLE_IMAGE)
        expect(mapPreviewImage("apple", { image: APPLE_IMAGE.replace("snapshot.apple-mapkit.com", "evil.com") })).toBeNull()
    })

    it("needs an image", () => {
        expect(mapPreviewImage("google", null)).toBeNull()
        expect(mapPreviewImage("apple", {})).toBeNull()
    })
})
