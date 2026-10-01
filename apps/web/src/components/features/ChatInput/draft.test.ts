import { describe, expect, it } from "vitest"
import { getDraftTeaser, saveDraft } from "./draft"

const teaserOf = (html: string) => {
    saveDraft("channel", html)
    return getDraftTeaser("channel")
}

describe("getDraftTeaser", () => {
    it("keeps custom emojis as their :name: and code in backticks", () => {
        const emoji = '<img src="/files/p.png" alt=":python:" data-type="customEmoji" class="emoji">'
        expect(teaserOf(`<p>hi ${emoji} run <code>x :y:</code></p>`)).toBe("hi :python: run `x :y:`")
    })

    it("strips other markup", () => {
        expect(teaserOf("<p>a <strong>b</strong> &amp; c</p>")).toBe("a b & c")
    })
})
