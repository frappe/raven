import { describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { buildForwardPayload } from "./forwardPayload"

/** Minimal text message; overrides layer on the fields a given test cares about. */
const msg = (overrides: Partial<Message> = {}): Message =>
    ({
        name: "msg-1",
        owner: "alice",
        _liked_by: "",
        channel_id: "ch-1",
        creation: "2026-07-31 10:00:00.000000",
        modified: "2026-07-31 10:00:00.000000",
        message_type: "Text",
        text: "<p>hello</p>",
        content: "hello",
        is_continuation: 0,
        is_reply: 0,
        is_edited: 0,
        is_forwarded: 0,
        is_thread: 0,
        is_pinned: 0,
        ...overrides,
    }) as Message

describe("buildForwardPayload", () => {
    it("keeps the body of a text message", () => {
        expect(buildForwardPayload(msg())).toEqual({
            message_type: "Text",
            text: "<p>hello</p>",
            content: "hello",
            is_reply: 0,
        })
    })

    it("keeps the thumbnail and blurhash of an image so the copy renders without a refetch", () => {
        const payload = buildForwardPayload(
            msg({
                message_type: "Image",
                file: "/files/cat.png",
                file_size: 1024,
                blurhash: "LEHV6nWB",
                thumbnail_width: 320,
                thumbnail_height: 240,
                // Real fieldname on Raven Message; the TS type calls it image_thumbnail.
                file_thumbnail: "/files/cat-small.png",
            } as Partial<Message>),
        )
        expect(payload.file).toBe("/files/cat.png")
        expect(payload.file_thumbnail).toBe("/files/cat-small.png")
        expect(payload.blurhash).toBe("LEHV6nWB")
        expect(payload.thumbnail_width).toBe(320)
        expect(payload.file_size).toBe(1024)
    })

    it("drops message_batch_id so the copy never fuses into an album in the destination", () => {
        const payload = buildForwardPayload(msg({ message_batch_id: "batch-9" }))
        expect(payload).not.toHaveProperty("message_batch_id")
    })

    it("keeps is_reply and replied_message_details — the backend needs them to inline the quote", () => {
        const details = JSON.stringify({ owner: "bob", message_type: "Text", text: "<p>original</p>" })
        const payload = buildForwardPayload(msg({ is_reply: 1, replied_message_details: details, linked_message: "msg-0" }))
        expect(payload.is_reply).toBe(1)
        expect(payload.replied_message_details).toBe(details)
        // linked_message points into the SOURCE channel — the quote replaces it.
        expect(payload).not.toHaveProperty("linked_message")
    })

    it("drops json for a reply — build_reply_blockquote only inlines the quote into text", () => {
        const details = JSON.stringify({ owner: "bob", message_type: "Text", text: "<p>original</p>" })
        const payload = buildForwardPayload(
            msg({
                is_reply: 1,
                replied_message_details: details,
                text: "<blockquote>original</blockquote><p>hello</p>",
                json: { type: "doc", content: [] },
            }),
        )
        expect(payload.text).toBe("<blockquote>original</blockquote><p>hello</p>")
        expect(payload).not.toHaveProperty("json")
    })

    it("keeps json for a non-reply", () => {
        const payload = buildForwardPayload(msg({ json: { type: "doc", content: [] } }))
        expect(payload.json).toEqual({ type: "doc", content: [] })
    })

    it("drops poll_id so a forwarded poll can never share the original's votes", () => {
        const payload = buildForwardPayload(msg({ message_type: "Poll", poll_id: "poll-1" }))
        expect(payload).not.toHaveProperty("poll_id")
    })

    it("drops bot attribution — the copy is sent by you, not by the bot that wrote it", () => {
        const payload = buildForwardPayload(msg({ is_bot_message: 1, bot: "bot-1" }))
        expect(payload).not.toHaveProperty("is_bot_message")
        expect(payload).not.toHaveProperty("bot")
    })

    it("drops reactions and client-only decorations", () => {
        const payload = buildForwardPayload(
            msg({ message_reactions: '{"👍":{"count":1}}', is_pinned: 1, formattedTime: "10:00 AM" }),
        )
        expect(payload).not.toHaveProperty("message_reactions")
        expect(payload).not.toHaveProperty("is_pinned")
        expect(payload).not.toHaveProperty("formattedTime")
    })

    it("omits absent fields rather than sending nulls", () => {
        const payload = buildForwardPayload(msg({ file: undefined, links: null } as unknown as Partial<Message>))
        expect(payload).not.toHaveProperty("file")
        expect(payload).not.toHaveProperty("links")
    })
})
