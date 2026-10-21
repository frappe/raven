import { describe, expect, it } from "vitest"
import { clampProgress, getFilledIntervals } from "./progress"

describe("clampProgress", () => {
    it("keeps values inside 0–100", () => {
        expect(clampProgress(42)).toBe(42)
        expect(clampProgress(150)).toBe(100)
        expect(clampProgress(-20)).toBe(0)
    })
    it("treats NaN as empty", () => {
        expect(clampProgress(Number.NaN)).toBe(0)
    })
})

describe("getFilledIntervals", () => {
    it("rounds to whole segments", () => {
        expect(getFilledIntervals(60, 5)).toBe(3)
        expect(getFilledIntervals(50, 4)).toBe(2)
        expect(getFilledIntervals(25, 3)).toBe(1)
    })
    it("fills nothing or everything at the ends", () => {
        expect(getFilledIntervals(0, 4)).toBe(0)
        expect(getFilledIntervals(100, 4)).toBe(4)
        expect(getFilledIntervals(150, 4)).toBe(4)
        expect(getFilledIntervals(-10, 4)).toBe(0)
    })
})
