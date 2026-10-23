import { describe, expect, it } from "vitest"
import { buildOptimisticMessages } from "./messageSender"

const CREATION = "2026-10-23 10:00:00.000000"

describe("buildOptimisticMessages", () => {
    it("builds a Voice placeholder for a file carrying voice metadata", () => {
        const voice = { duration: 7.25, waveform: [0, 50, 100] }
        const [message] = buildOptimisticMessages("ch", "batch", "me", "", [{ file_url: "/private/files/v.m4a", file_size: 10, voice }], CREATION)
        expect(message).toMatchObject({ message_type: "Voice", json: voice, file: "/private/files/v.m4a", _status: "sending" })
    })

    it("keeps a plain audio file as a File placeholder", () => {
        const [message] = buildOptimisticMessages("ch", "batch", "me", "", [{ file_url: "/private/files/a.m4a", file_size: 10 }], CREATION)
        expect(message.message_type).toBe("File")
        expect("json" in message).toBe(false)
    })
})
