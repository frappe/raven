import { downsamplePeaks, type VoiceNoteMeta } from "@lib/voiceNote"

// decodeAudioData resamples to the context's rate: 8 kHz keeps a 10-minute clip near 19 MB.
const DECODE_SAMPLE_RATE = 8000

/** Duration + waveform from the recorded clip; null when the browser can't decode it. */
export const measureVoiceNote = async (file: Blob): Promise<VoiceNoteMeta | null> => {
    try {
        const context = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE)
        const audio = await context.decodeAudioData(await file.arrayBuffer())
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return null
        return {
            duration: Math.round(audio.duration * 100) / 100,
            waveform: downsamplePeaks(audio.getChannelData(0)),
        }
    } catch {
        return null
    }
}
