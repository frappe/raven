import { describe, expect, it } from "vitest"
import { finaleSchedule } from "./finale"

describe("finaleSchedule", () => {
    it("fades the form out, shows the check, swaps in the sign-off, expands the preview, then fades onto the app", () => {
        expect(finaleSchedule({ reducedMotion: false, previewShown: true })).toEqual([
            { at: 0, phase: "out" },
            { at: 250, phase: "done" },
            { at: 1650, phase: "send" },
            { at: 4650, phase: "expand" },
            { at: 5250, phase: "leave" },
            { at: 5500, phase: "closed" },
        ])
    })

    it("skips the expansion where there's no preview", () => {
        expect(finaleSchedule({ reducedMotion: false, previewShown: false })).toEqual([
            { at: 0, phase: "out" },
            { at: 250, phase: "done" },
            { at: 1650, phase: "send" },
            { at: 4650, phase: "leave" },
            { at: 4900, phase: "closed" },
        ])
    })

    it("shows the check and then the sign-off without motion, then the app", () => {
        expect(finaleSchedule({ reducedMotion: true, previewShown: true })).toEqual([
            { at: 0, phase: "done" },
            { at: 1000, phase: "send" },
            { at: 2000, phase: "closed" },
        ])
    })
})
