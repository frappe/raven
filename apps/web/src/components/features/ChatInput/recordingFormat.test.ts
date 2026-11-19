import { describe, expect, it } from "vitest"
import { getAttachmentKind } from "@utils/attachmentPreview"
import { RECORDING_FORMATS, micErrorKind, pickRecordingFormat, voiceNoteFileName } from "./recordingFormat"

describe("pickRecordingFormat", () => {
    it("prefers AAC mp4, then any mp4, then ogg, then webm", () => {
        expect(pickRecordingFormat(() => true)?.mimeType).toBe("audio/mp4;codecs=mp4a.40.2")
        expect(pickRecordingFormat((t) => t === "audio/mp4" || t === "audio/webm")?.mimeType).toBe("audio/mp4")
        expect(pickRecordingFormat((t) => !t.startsWith("audio/mp4"))?.extension).toBe("ogg")
        expect(pickRecordingFormat((t) => t === "audio/webm")?.extension).toBe("weba")
    })

    it("returns null when nothing is supported", () => {
        expect(pickRecordingFormat(() => false)).toBeNull()
    })

    it("only names files with extensions the stream renders as audio", () => {
        for (const format of RECORDING_FORMATS) {
            expect(getAttachmentKind(`/files/x.${format.extension}`)).toBe("audio")
        }
    })
})

describe("voiceNoteFileName", () => {
    it("stamps local date and time", () => {
        expect(voiceNoteFileName(new Date(2026, 9, 21, 9, 5, 7), "m4a")).toBe("voice-note-20261021-090507.m4a")
    })
})

describe("micErrorKind", () => {
    const err = (name: string) => Object.assign(new Error(name), { name })

    it("maps getUserMedia errors", () => {
        expect(micErrorKind(err("NotAllowedError"))).toBe("blocked")
        expect(micErrorKind(err("SecurityError"))).toBe("blocked")
        expect(micErrorKind(err("NotFoundError"))).toBe("missing")
        expect(micErrorKind(err("OverconstrainedError"))).toBe("missing")
        expect(micErrorKind(err("NotReadableError"))).toBe("busy")
        expect(micErrorKind(err("AbortError"))).toBe("busy")
        expect(micErrorKind(err("TypeError"))).toBe("unknown")
        expect(micErrorKind("nope")).toBe("unknown")
    })
})
