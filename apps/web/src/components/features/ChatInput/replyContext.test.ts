import { describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { replyContext } from "./replyContext"

describe("replyContext", () => {
    it("is empty without a reply", () => {
        expect(replyContext(null)).toEqual({ linkedMessage: undefined, repliedMessageDetails: undefined })
    })

    it("links the message and snapshots what the reply preview shows", () => {
        const message = {
            name: "m1", text: "<p>hi</p>", content: "hi", file: "/files/a.png",
            message_type: "Text", owner: "a@example.com", creation: "2026-11-04 10:00:00.000000",
        } as unknown as Message
        const { linkedMessage, repliedMessageDetails } = replyContext(message)
        expect(linkedMessage).toBe("m1")
        expect(JSON.parse(repliedMessageDetails!)).toEqual({
            content: "hi", file: "/files/a.png", message_type: "Text", owner: "a@example.com", creation: "2026-11-04 10:00:00.000000",
        })
    })

    it("fills a missing content or file with an empty string", () => {
        const message = { name: "m2", message_type: "Poll", owner: "a@example.com", creation: "c" } as unknown as Message
        expect(JSON.parse(replyContext(message).repliedMessageDetails!)).toMatchObject({ content: "", file: "" })
    })
})
