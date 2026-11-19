import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SearchResult } from "@hooks/useSqliteSearch"
import { searchResultToMessage } from "./searchResultToMessage"

describe("searchResultToMessage", () => {
    // _() reads window.frappe for translations; node has no window.
    beforeEach(() => vi.stubGlobal("window", {}))
    afterEach(() => vi.unstubAllGlobals())

    it("shows a voice note as a labelled placeholder, not a blank row", () => {
        const row = { id: "m1", author: "a@x.com", channel_id: "ch", creation: "2026-10-23 10:00:00", message_type: "Voice", content: "" } as unknown as SearchResult
        const message = searchResultToMessage(row)
        expect(message.message_type).toBe("Text")
        expect(message.text).toContain("Voice note")
    })
})
