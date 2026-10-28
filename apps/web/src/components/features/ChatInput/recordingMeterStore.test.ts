import { describe, expect, it, vi } from "vitest"
import { createRecordingMeter } from "./recordingMeterStore"

describe("createRecordingMeter", () => {
    it("starts empty", () => {
        expect(createRecordingMeter(4).get()).toEqual({ elapsed: 0, heights: [], tickedAt: 0, count: 0 })
    })

    it("records each tick with its time and notifies subscribers", () => {
        const meter = createRecordingMeter(4)
        const listener = vi.fn()
        meter.subscribe(listener)
        meter.tick(100, 0.5, 1000)
        expect(meter.get()).toEqual({ elapsed: 100, heights: [100], tickedAt: 1000, count: 1 })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it("scales each bar against the recent loudest level", () => {
        const meter = createRecordingMeter(4)
        meter.tick(100, 0.4, 0)
        meter.tick(200, 0.8, 0)
        meter.tick(300, 0.4, 0)
        const [first, second, third] = meter.get().heights
        expect([first, second]).toEqual([100, 100])
        // Half the peak, give or take its slow decay.
        expect(third).toBeGreaterThanOrEqual(50)
        expect(third).toBeLessThanOrEqual(52)
    })

    it("recovers from a one-off spike within seconds", () => {
        const meter = createRecordingMeter(4)
        meter.tick(0, 1, 0)
        for (let index = 1; index <= 100; index++) meter.tick(index * 100, 0.3, 0)
        const { heights } = meter.get()
        expect(heights[heights.length - 1]).toBe(100)
    })

    it("keeps a bar's height once it is drawn", () => {
        const meter = createRecordingMeter(4)
        meter.tick(100, 0.5, 0)
        meter.tick(200, 1, 0)
        expect(meter.get().heights[0]).toBe(100)
    })

    it("keeps background noise low before anyone speaks", () => {
        const meter = createRecordingMeter(4)
        meter.tick(100, 0.03, 0)
        expect(meter.get().heights[0]).toBeLessThanOrEqual(20)
    })

    it("draws quiet speech at full height", () => {
        const meter = createRecordingMeter(4)
        meter.tick(100, 0.15, 0)
        expect(meter.get().heights[0]).toBe(100)
    })

    it("keeps only the newest bars", () => {
        const meter = createRecordingMeter(2)
        meter.tick(100, 0.5, 0)
        meter.tick(200, 0.5, 0)
        meter.tick(300, 1, 0)
        expect(meter.get().heights).toEqual([100, 100])
    })

    it("counts every tick, including bars dropped off the start", () => {
        const meter = createRecordingMeter(2)
        for (let index = 0; index < 5; index++) meter.tick(index * 100, 0.5, 0)
        expect(meter.get().count).toBe(5)
        expect(meter.get().heights).toHaveLength(2)
    })

    it("returns the same snapshot until the next tick", () => {
        const meter = createRecordingMeter(4)
        meter.tick(100, 0.5, 0)
        expect(meter.get()).toBe(meter.get())
    })

    it("stops notifying after unsubscribe", () => {
        const meter = createRecordingMeter(4)
        const listener = vi.fn()
        const unsubscribe = meter.subscribe(listener)
        unsubscribe()
        meter.tick(100, 0.5, 0)
        expect(listener).not.toHaveBeenCalled()
    })
})
