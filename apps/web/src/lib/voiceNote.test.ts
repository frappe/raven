import { describe, expect, it } from "vitest"
import { WAVEFORM_BARS, downsamplePeaks, encodeWaveform, isVoiceNote, parseWaveform, voiceNoteMessageFields } from "./voiceNote"

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

describe("waveform encoding", () => {
    it("round-trips", () => {
        expect(parseWaveform(encodeWaveform([0, 50, 100]))).toEqual([0, 50, 100])
    })

    it("tolerates malformed strings", () => {
        expect(parseWaveform("")).toEqual([])
        expect(parseWaveform(undefined)).toEqual([])
        expect(parseWaveform(null)).toEqual([])
        expect(parseWaveform("abc")).toEqual([])
        expect(parseWaveform("10,abc,150,-3")).toEqual([10, 100, 0])
    })
})

describe("isVoiceNote", () => {
    it("needs an audio file and a waveform", () => {
        expect(isVoiceNote({ file: "/files/a.m4a", audio_waveform: "1,2" })).toBe(true)
        expect(isVoiceNote({ file: "/files/a.m4a" })).toBe(false)
        expect(isVoiceNote({ file: "/files/a.m4a", audio_waveform: "" })).toBe(false)
        expect(isVoiceNote({ file: "/files/a.png", audio_waveform: "1,2" })).toBe(false)
        expect(isVoiceNote({ audio_waveform: "1,2" })).toBe(false)
    })
})

describe("voiceNoteMessageFields", () => {
    it("maps upload metadata onto message fields", () => {
        expect(voiceNoteMessageFields({ duration: 7, waveform: "1,2" })).toEqual({ audio_duration: 7, audio_waveform: "1,2" })
        expect(voiceNoteMessageFields({})).toEqual({})
    })
})
