import { describe, expect, it, vi } from "vitest"
import { createRecordingMeter } from "./recordingMeterStore"

describe("createRecordingMeter", () => {
    it("starts empty", () => {
        expect(createRecordingMeter(4).get()).toEqual({ elapsed: 0, levels: [] })
    })

    it("records each tick and notifies subscribers", () => {
        const meter = createRecordingMeter(4)
        const listener = vi.fn()
        meter.subscribe(listener)
        meter.tick(100, 0.5)
        expect(meter.get()).toEqual({ elapsed: 100, levels: [0.5] })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it("keeps only the newest samples", () => {
        const meter = createRecordingMeter(2)
        meter.tick(100, 0.1)
        meter.tick(200, 0.2)
        meter.tick(300, 0.3)
        expect(meter.get().levels).toEqual([0.2, 0.3])
    })

    it("returns the same snapshot until the next tick", () => {
        const meter = createRecordingMeter(4)
        meter.tick(100, 0.5)
        expect(meter.get()).toBe(meter.get())
    })

    it("stops notifying after unsubscribe", () => {
        const meter = createRecordingMeter(4)
        const listener = vi.fn()
        const unsubscribe = meter.subscribe(listener)
        unsubscribe()
        meter.tick(100, 0.5)
        expect(listener).not.toHaveBeenCalled()
    })
})
