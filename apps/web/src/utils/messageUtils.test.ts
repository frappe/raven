import { describe, expect, it } from "vitest"
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
})
