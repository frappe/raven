import { afterEach, describe, expect, it, vi } from "vitest"
import {
    MAP_ATTRIBUTION_HTML,
    MAP_TILE_URL,
    appleMapsAppUrl,
    appleMapsUrl,
    formatCoordinates,
    geoUri,
    googleMapsAppUrl,
    googleMapsUrl,
    parseLocationJson,
    tilesFor,
    wazeAppUrl,
    wazeWebUrl,
} from "./location"

afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock("@utils/platform")
    vi.resetModules()
})

describe("parseLocationJson", () => {
    it("reads objects and JSON strings", () => {
        expect(parseLocationJson({ latitude: 1, longitude: 2 })).toEqual({ latitude: 1, longitude: 2 })
        expect(parseLocationJson('{"latitude":1,"longitude":2}')).toEqual({ latitude: 1, longitude: 2 })
    })
    it("rejects bad coordinates and junk", () => {
        for (const junk of [null, "x", "{", [], { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: Infinity, longitude: 0 }, { latitude: "1", longitude: 2 }, { latitude: NaN, longitude: 0 }])
            expect(parseLocationJson(junk)).toBeNull()
    })
    it("drops extra keys", () => {
        const json = { latitude: 1, longitude: 2, name: "Cafe", address: "Road", foo: {} }
        expect(parseLocationJson(json)).toEqual({ latitude: 1, longitude: 2 })
    })
})

describe("tilesFor", () => {
    it("centres the point in the box and covers it", () => {
        const tiles = tilesFor(12.9756, 77.6066, 16, 64, 64, 128)
        expect(tiles.length).toBeGreaterThan(0)
        expect(tiles.length).toBeLessThanOrEqual(4)
        expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0)
        expect(Math.max(...tiles.map((t) => t.left + t.size))).toBeGreaterThanOrEqual(64)
        expect(tiles[0].url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/)
    })
    it("wraps x at the antimeridian", () => {
        const xs = tilesFor(0, 179.9999, 2, 300, 100).map((t) => Number(t.url.split("/")[4]))
        expect(xs.every((x) => x >= 0 && x < 4)).toBe(true)
    })
    it("does not read the boot", () => {
        vi.stubGlobal("window", {
            get frappe() {
                throw new Error("boot is read")
            },
        })
        expect(() => tilesFor(12.9756, 77.6066, 16, 64, 64)).not.toThrow()
    })
})

describe("map constants", () => {
    it("use OpenStreetMap", () => {
        expect(MAP_TILE_URL).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png")
        expect(MAP_ATTRIBUTION_HTML).toBe(
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        )
        expect(MAP_ATTRIBUTION_HTML).toContain("https://www.openstreetmap.org/copyright")
    })
})

describe("map URLs", () => {
    const meta = { latitude: 12.97561, longitude: 77.60659 }
    it("builds web links", () => {
        expect(googleMapsUrl(meta)).toBe("https://www.google.com/maps/search/?api=1&query=12.97561,77.60659")
        expect(appleMapsUrl(meta)).toBe("https://maps.apple.com/?ll=12.97561,77.60659&q=Location")
    })
    it("builds app links", () => {
        expect(geoUri(meta)).toBe("geo:12.97561,77.60659?q=12.97561,77.60659(Location)")
        expect(googleMapsAppUrl(meta)).toBe("comgooglemaps://?q=12.97561,77.60659&center=12.97561,77.60659")
        expect(wazeAppUrl(meta)).toBe("waze://?ll=12.97561,77.60659&navigate=no")
        expect(wazeWebUrl(meta)).toBe("https://www.waze.com/ul?ll=12.97561,77.60659")
        expect(appleMapsAppUrl(meta)).toBe("maps://?ll=12.97561,77.60659&q=Location")
    })
    it("picks Apple Maps on iOS", async () => {
        vi.doMock("@utils/platform", () => ({ isIOS: true }))
        vi.resetModules()
        const { senderMapsProvider, senderMapsUrl } = await import("./location")
        expect(senderMapsProvider()).toBe("apple")
        expect(senderMapsUrl(meta)).toBe(appleMapsUrl(meta))
    })
    it("picks Google Maps elsewhere", async () => {
        vi.doMock("@utils/platform", () => ({ isIOS: false }))
        vi.resetModules()
        const { senderMapsProvider, senderMapsUrl } = await import("./location")
        expect(senderMapsProvider()).toBe("google")
        expect(senderMapsUrl(meta)).toBe(googleMapsUrl(meta))
    })
})

describe("formatCoordinates", () => {
    it("formats to 5 decimal places", () => {
        expect(formatCoordinates({ latitude: 12.975612, longitude: 77.6 })).toBe("12.97561, 77.60000")
    })
})
