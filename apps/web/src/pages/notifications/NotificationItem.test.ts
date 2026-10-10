import { describe, expect, it } from "vitest"
import { hasRenderableContent } from "./NotificationItem"

describe("hasRenderableContent", () => {
    it("treats an empty paragraph as blank", () => {
        // An image message with no caption — the bug: truthy HTML, renders nothing.
        expect(hasRenderableContent("<p></p>")).toBe(false)
        expect(hasRenderableContent("<p>  </p>")).toBe(false)
    })

    it("keeps text and embedded media", () => {
        expect(hasRenderableContent("<p>hi</p>")).toBe(true)
        // A custom-emoji-only message is all <img> and must stay rich.
        expect(hasRenderableContent('<p><img src="/files/party.png" data-type="customEmoji"></p>')).toBe(true)
    })
})
