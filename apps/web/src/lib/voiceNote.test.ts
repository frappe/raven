import { describe, expect, it } from "vitest"
import { WAVEFORM_BARS, downsamplePeaks, parseVoiceJson } from "./voiceNote"

describe("downsamplePeaks", () => {
    it("returns zeros for silence and for empty input", () => {
        expect(downsamplePeaks(new Float32Array(4800))).toEqual(new Array(WAVEFORM_BARS).fill(0))
        expect(downsamplePeaks(new Float32Array(0))).toEqual(new Array(WAVEFORM_BARS).fill(0))
    })

    it("puts a single spike in its bucket at full height", () => {
        const samples = new Float32Array(4800)
        samples[2400] = 0.5
        const peaks = downsamplePeaks(samples)
        expect(peaks[24]).toBe(100)
        expect(peaks.filter((p) => p > 0)).toHaveLength(1)
    })

    it("normalizes to the loudest bucket and uses absolute values", () => {
        const samples = new Float32Array(200)
        samples.fill(0.25, 0, 100)
        samples.fill(-0.5, 100, 200)
        expect(downsamplePeaks(samples, 2)).toEqual([50, 100])
    })

    it("handles input shorter than the bar count", () => {
        expect(downsamplePeaks(new Float32Array([0.5]), 4)).toEqual([100, 100, 100, 100])
    })
})

describe("parseVoiceJson", () => {
    it("reads objects and JSON strings", () => {
        expect(parseVoiceJson({ duration: 7.5, waveform: [0, 50, 100] })).toEqual({ duration: 7.5, waveform: [0, 50, 100] })
        expect(parseVoiceJson('{"duration":3,"waveform":[10]}')).toEqual({ duration: 3, waveform: [10] })
    })

    it("clamps, rounds, drops non-numeric bars and caps at 64", () => {
        expect(parseVoiceJson({ duration: 1, waveform: [-5, 150, 42.6, "x", null, Infinity] })).toEqual({ duration: 1, waveform: [0, 100, 43] })
        expect(parseVoiceJson({ duration: 1, waveform: new Array(500).fill(10) })?.waveform).toHaveLength(64)
    })

    it("keeps a voice note with an unusable waveform", () => {
        expect(parseVoiceJson({ duration: 2, waveform: "abc" })).toEqual({ duration: 2, waveform: [] })
        expect(parseVoiceJson({ duration: 2 })).toEqual({ duration: 2, waveform: [] })
    })

    it("rejects anything without a positive finite duration", () => {
        for (const junk of [null, undefined, "", "{", "[]", 5, {}, { duration: 0 }, { duration: -1 }, { duration: "3" }, { duration: Infinity }]) {
            expect(parseVoiceJson(junk)).toBeNull()
        }
    })
})
