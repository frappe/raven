import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { voiceNoteLabel } from "./voiceNoteLabel"

describe("voiceNoteLabel", () => {
    // _() reads window.frappe for translations; node has no window.
    beforeEach(() => vi.stubGlobal("window", {}))
    afterEach(() => vi.unstubAllGlobals())

    it("includes the length when the payload is readable", () => {
        expect(voiceNoteLabel('{"duration":72,"waveform":[]}')).toBe("Voice note · 1:12")
    })

    it("falls back to a plain label", () => {
        expect(voiceNoteLabel(undefined)).toBe("Voice note")
        expect(voiceNoteLabel("{bad")).toBe("Voice note")
    })
})
