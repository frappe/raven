import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    SNAPSHOT_SIZE,
    drawSnapshot,
    snapshotDrawPlan,
    snapshotFileName,
    withTimeout,
} from "./snapshot"

const zoomOf = (url: string): number => Number(url.split("/")[3])

afterEach(() => vi.useRealTimers())

const META = { latitude: 12.9756, longitude: 77.6066 }

describe("snapshotDrawPlan", () => {
    it("centres the point on the 128 px canvas", () => {
        const { tiles, pin } = snapshotDrawPlan(META, 17)
        expect(SNAPSHOT_SIZE).toBe(128)
        expect(pin).toEqual({ x: 64, y: 64 })
        expect(tiles.every((tile) => tile.size === 256)).toBe(true)
        expect(Math.min(...tiles.map((tile) => tile.left))).toBeLessThanOrEqual(0)
        expect(Math.max(...tiles.map((tile) => tile.left + tile.size))).toBeGreaterThanOrEqual(128)
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

describe("snapshotFileName", () => {
    it("uses six decimals for the coordinates", () => {
        const name = snapshotFileName({ latitude: 12.975612, longitude: 77.606634 }, "image/webp")
        expect(name).toBe("location-12.975612-77.606634.webp")
    })

    it("uses png when the browser encodes png", () => {
        expect(snapshotFileName({ latitude: 1, longitude: 2 }, "image/png")).toBe(
            "location-1.000000-2.000000.png",
        )
    })
})

describe("withTimeout", () => {
    it("times out a slow snapshot", async () => {
        vi.useFakeTimers()
        const result = withTimeout(new Promise(() => {}), 5000)
        vi.advanceTimersByTime(5000)
        await expect(result).resolves.toBeNull()
    })

    it("passes a fast result through", async () => {
        await expect(withTimeout(Promise.resolve("ok"), 5000)).resolves.toBe("ok")
    })
})

describe("drawSnapshot", () => {
    beforeEach(() => vi.stubGlobal("Path2D", class {}))
    afterEach(() => vi.unstubAllGlobals())

    const contextOf = () => ({
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        fillStyle: "",
        font: "",
    })

    it("paints the tiles and the pin, with no text or chip", () => {
        const context = contextOf()
        const plan = snapshotDrawPlan(META, 17)
        drawSnapshot(
            context as unknown as CanvasRenderingContext2D,
            plan,
            plan.tiles.map(() => ({}) as HTMLImageElement),
        )

        expect(context.drawImage).toHaveBeenCalledTimes(plan.tiles.length)
        expect(context.fill).toHaveBeenCalledTimes(2)
        expect(context.fillText).not.toHaveBeenCalled()
        expect(context.fillRect).not.toHaveBeenCalled()
        expect(context.measureText).not.toHaveBeenCalled()
    })
})
