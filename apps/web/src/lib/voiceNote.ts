export const WAVEFORM_BARS = 48
// The server's cap (_MAX_WAVEFORM_BARS); recordings send WAVEFORM_BARS.
const MAX_WAVEFORM_BARS = 64

/** A voice note's payload, stored in the message's `json`. */
export type VoiceNoteMeta = { duration: number; waveform: number[] }

/** Peak per bucket, scaled so the loudest bucket is 100. */
export const downsamplePeaks = (samples: ArrayLike<number>, bars = WAVEFORM_BARS): number[] => {
    const peaks = new Array<number>(bars).fill(0)
    if (samples.length === 0) return peaks
    for (let i = 0; i < bars; i++) {
        // start < length for every i, so end never runs past the samples
        const start = Math.floor((i * samples.length) / bars)
        const end = Math.max(start + 1, Math.floor(((i + 1) * samples.length) / bars))
        let peak = 0
        for (let j = start; j < end; j++) {
            const magnitude = Math.abs(samples[j])
            if (magnitude > peak) peak = magnitude
        }
        peaks[i] = peak
    }
    const loudest = Math.max(...peaks)
    return loudest === 0 ? peaks.map(() => 0) : peaks.map((peak) => Math.round((peak / loudest) * 100))
}

/** A voice note's `json` (object, or string from a fetch); null unless it has a usable duration. */
export const parseVoiceJson = (json: unknown): VoiceNoteMeta | null => {
    let value = json
    if (typeof value === "string") {
        try {
            value = JSON.parse(value)
        } catch {
            return null
        }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const { duration, waveform } = value as { duration?: unknown; waveform?: unknown }
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return null
    const bars = Array.isArray(waveform)
        ? waveform
            .filter((bar): bar is number => typeof bar === "number" && Number.isFinite(bar))
            .slice(0, MAX_WAVEFORM_BARS)
            .map((bar) => Math.min(100, Math.max(0, Math.round(bar))))
        : []
    return { duration, waveform: bars }
}
