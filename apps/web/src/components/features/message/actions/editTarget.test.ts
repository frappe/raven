import { describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { resolveEditTarget } from "./editTarget"

const message = (text: string) => ({ name: "m1", channel_id: "c1", message_type: "Text", text }) as unknown as Message

describe("resolveEditTarget", () => {
    it("edits a text message", () => {
        const text = message("<p>hello</p>")
        expect(resolveEditTarget(text)).toBe(text)
    })

    // The editor has no image node: it would open empty, and saving empty deletes the message.
    it("doesn't edit a KLIPY GIF", () => {
        expect(resolveEditTarget(message('<p><img data-type="gif" src="https://static.klipy.com/ii/a" alt="Hi"></p>'))).toBeNull()
    })

    it("doesn't edit a Tenor GIF", () => {
        expect(resolveEditTarget(message('<p><img src="https://media.tenor.com/abc.gif"></p>'))).toBeNull()
    })
})
