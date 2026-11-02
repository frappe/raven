import { describe, expect, it, vi } from "vitest"
import {
    SNAPSHOT_FILE_NAME,
    SNAPSHOT_HEIGHT,
    SNAPSHOT_WIDTH,
    drawSnapshot,
    snapshotDrawPlan,
} from "./snapshot"

const zoomOf = (url: string): number => Number(url.split("/")[3])

const META = { latitude: 12.9756, longitude: 77.6066 }

describe("snapshotDrawPlan", () => {
    it("covers the 240 × 160 canvas", () => {
        const { tiles } = snapshotDrawPlan(META, 17)
        expect(SNAPSHOT_WIDTH).toBe(240)
        expect(SNAPSHOT_HEIGHT).toBe(160)
        expect(tiles.every((tile) => tile.size === 256)).toBe(true)
        expect(Math.min(...tiles.map((tile) => tile.left))).toBeLessThanOrEqual(0)
        expect(Math.max(...tiles.map((tile) => tile.left + tile.size))).toBeGreaterThanOrEqual(240)
        expect(Math.min(...tiles.map((tile) => tile.top))).toBeLessThanOrEqual(0)
        expect(Math.max(...tiles.map((tile) => tile.top + tile.size))).toBeGreaterThanOrEqual(160)
    })

    it("fetches tiles at the map's zoom", () => {
        const { tiles } = snapshotDrawPlan(META, 17)
        expect(new Set(tiles.map((tile) => zoomOf(tile.url)))).toEqual(new Set([17]))
    })

    it.each([
        [12, 15],
        [20, 18],
    ])("clamps zoom %i to %i", (zoom, clamped) => {
        const { tiles } = snapshotDrawPlan(META, zoom)
        expect(new Set(tiles.map((tile) => zoomOf(tile.url)))).toEqual(new Set([clamped]))
    })
})

describe("SNAPSHOT_FILE_NAME", () => {
    it("is a JPEG name with no digits: coordinates must not reach a file path", () => {
        expect(SNAPSHOT_FILE_NAME).toBe("location.jpg")
        expect(SNAPSHOT_FILE_NAME).not.toMatch(/\d/)
    })
})

describe("drawSnapshot", () => {
    const contextOf = () => ({
        drawImage: vi.fn(),
    })

    it("paints only the tiles", () => {
        const context = contextOf()
        const plan = snapshotDrawPlan(META, 17)
        const images = plan.tiles.map(() => ({}) as HTMLImageElement)
        drawSnapshot(context as unknown as CanvasRenderingContext2D, plan, images)

        expect(context.drawImage.mock.calls).toEqual(
            plan.tiles.map((tile, index) => [images[index], tile.left, tile.top, tile.size, tile.size]),
        )
    })
})
