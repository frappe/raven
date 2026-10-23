export type RecordingFormat = { mimeType: string; extension: string }

/** Priority order. Extensions must classify as audio in attachmentPreview (`.webm` is video). */
export const RECORDING_FORMATS: RecordingFormat[] = [
    // AAC first: Chrome otherwise puts Opus in the MP4, which fewer players accept.
    { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a" },
    { mimeType: "audio/mp4", extension: "m4a" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
    { mimeType: "audio/webm", extension: "weba" },
]

export const MIN_RECORDING_MS = 1000
export const MAX_RECORDING_MS = 600_000

export const pickRecordingFormat = (isTypeSupported: (type: string) => boolean): RecordingFormat | null =>
    RECORDING_FORMATS.find((format) => isTypeSupported(format.mimeType)) ?? null

let voiceSupported: boolean | undefined

/** Mic entry points render only when this is true. Checked once: composers remount on every channel switch. */
export const canRecordVoice = (): boolean =>
    (voiceSupported ??=
        typeof MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        pickRecordingFormat((type) => MediaRecorder.isTypeSupported(type)) !== null)

const pad = (value: number) => value.toString().padStart(2, "0")

export const voiceNoteFileName = (date: Date, extension: string) =>
    `voice-note-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.${extension}`

export type MicErrorKind = "blocked" | "missing" | "busy" | "unknown"

export const micErrorKind = (error: unknown): MicErrorKind => {
    const name = (error as { name?: string } | null)?.name
    switch (name) {
        case "NotAllowedError":
        case "SecurityError":
            return "blocked"
        case "NotFoundError":
        case "OverconstrainedError":
            return "missing"
        case "NotReadableError":
        case "AbortError":
            return "busy"
        default:
            return "unknown"
    }
}
