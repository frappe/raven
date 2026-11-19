import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PositionFix } from "../../../../native/geolocation"
import { centreOf, isPanKey, pickerPanel } from "./pickerPanel"

// _() reads window.frappe; node has no window.
beforeEach(() => vi.stubGlobal("window", {}))
afterEach(() => vi.unstubAllGlobals())

const fix: PositionFix = { latitude: 12.9756, longitude: 77.6066, accuracy: 15.4 }

describe("pickerPanel", () => {
    it("offers the current location until the map is dragged", () => {
        expect(pickerPanel({ centre: fix, fix, dragged: false })).toEqual({
            title: "Send your current location",
            subtitle: "Accurate to 15 m",
        })
    })
    it("offers the pin after a drag", () => {
        expect(pickerPanel({ centre: { latitude: 12.98, longitude: 77.61 }, fix, dragged: true })).toEqual({
            title: "Send this location",
            subtitle: "12.98000, 77.61000",
        })
    })
})

describe("isPanKey", () => {
    it("recognises the arrow keys Leaflet pans with", () => {
        for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) expect(isPanKey(key)).toBe(true)
        for (const key of ["a", "Enter", "Escape", "+", "-"]) expect(isPanKey(key)).toBe(false)
    })
})

describe("centreOf", () => {
    it("maps Leaflet's centre to coordinates", () => {
        expect(centreOf({ lat: 1, lng: 2 })).toEqual({ latitude: 1, longitude: 2 })
    })
})
