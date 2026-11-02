import { describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { buildReplySnapshot } from "./replySnapshot"

const base = { owner: "a@x.com", creation: "2026-10-23 10:00:00.000000", name: "m1" }

describe("buildReplySnapshot", () => {
    it("is undefined without a message", () => {
        expect(buildReplySnapshot(null)).toBeUndefined()
    })

    it("matches the server's text snapshot", () => {
        const text = { ...base, message_type: "Text", content: "hi", text: "<p>hi</p>" } as unknown as Message
        expect(JSON.parse(buildReplySnapshot(text)!)).toEqual({ content: "hi", file: "", message_type: "Text", owner: "a@x.com", creation: base.creation })
    })

    it("carries a voice note's payload", () => {
        const voice = { ...base, message_type: "Voice", file: "/private/files/v.m4a", json: '{"duration":7,"waveform":[1]}' } as unknown as Message
        expect(JSON.parse(buildReplySnapshot(voice)!).json).toEqual({ duration: 7, waveform: [1] })
    })
})
