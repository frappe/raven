import { describe, expect, it, vi } from "vitest"
import { getMessageTeaser } from "./messageUtils"

describe("getMessageTeaser", () => {
    it("neutralizes backticks in file names and poll questions", () => {
        // Backtick is the teaser's code marker; arbitrary strings must not carry it.
        expect(getMessageTeaser({ message_type: "File", content: "a`b`.txt" })).toBe("📎 aˋbˋ.txt")
        expect(getMessageTeaser({ message_type: "Poll", content: "pick `one`?\n1. a" })).toBe("📊 pick ˋoneˋ?")
    })

    it("keeps the server's code markers in text teasers", () => {
        expect(getMessageTeaser({ message_type: "Text", content: "run `x` now" })).toBe("run `x` now")
    })

    it("labels voice notes", () => {
        // _() reads window.frappe for translations; node has no window.
        vi.stubGlobal("window", {})
        expect(getMessageTeaser({ message_type: "Voice", content: "" })).toBe("🎤 Voice note")
        vi.unstubAllGlobals()
    })

    it("labels locations without printing the fallback link", () => {
        vi.stubGlobal("window", {})
        expect(getMessageTeaser({ message_type: "Location", content: "https://www.google.com/maps/search/?api=1&query=1,2" })).toBe("📍 Location")
        vi.unstubAllGlobals()
    })
})
