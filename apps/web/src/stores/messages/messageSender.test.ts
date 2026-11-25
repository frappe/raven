import { describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import type { OutboxMessage } from "@db"
import { injectOutboxRecord } from "./messageSender"
import { channelMessagesStore } from "./store"

const record = (clientID: string): OutboxMessage =>
    ({
        client_id: clientID,
        channel_id: "ch-outbox",
        owner: "alice",
        content: "hi",
        files: [],
        creation: "2026-06-10 10:00:00.000000",
        status: "sending",
        queued_at: 0,
    }) as OutboxMessage

describe("injectOutboxRecord", () => {
    it("does not restore a send whose real message is already on screen", () => {
        const delivered = {
            name: "real",
            channel_id: "ch-outbox",
            owner: "alice",
            creation: "2026-06-10 10:00:01.000000",
            modified: "2026-06-10 10:00:01.000000",
            message_type: "Text",
            text: "hi",
            message_batch_id: "b1",
        } as Message
        channelMessagesStore.setInitialPage("ch-outbox", { messages: [delivered] })

        injectOutboxRecord(record("b1"))
        injectOutboxRecord(record("b2"))

        expect(channelMessagesStore.getState("ch-outbox").order).toEqual(["b2-text", "real"])
    })
})
