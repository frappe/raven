import { getAttachmentKind } from "@utils/attachmentPreview"

export const WAVEFORM_BARS = 48

export type VoiceNoteMeta = { duration: number; waveform: string }

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

export const encodeWaveform = (peaks: number[]) => peaks.join(",")

/** Malformed entries are skipped; values clamp to 0-100. */
export const parseWaveform = (value: string | null | undefined): number[] => {
    if (!value) return []
    return value
        .split(",")
        .map(Number)
        .filter((bar) => Number.isFinite(bar))
        .map((bar) => Math.min(100, Math.max(0, Math.round(bar))))
}

export const isVoiceNote = (message: { file?: string; audio_waveform?: string | null }): boolean =>
    !!message.file && !!message.audio_waveform && getAttachmentKind(message.file) === "audio"

/** Upload metadata → the message fields the server stores. */
export const voiceNoteMessageFields = (file: { duration?: number; waveform?: string }) => ({
    ...(file.duration ? { audio_duration: file.duration } : {}),
    ...(file.waveform ? { audio_waveform: file.waveform } : {}),
})
