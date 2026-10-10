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

    it("neutralizes literal backticks so only code markers remain", () => {
        expect(teaserOf("<p>press ` then <code>a ` b</code></p>")).toBe("press ˋ then `a ˋ b`")
    })

    it("decodes escaped quotes in an emoji's alt", () => {
        // The browser serializes alt=':say"hi:' as alt=":say&quot;hi:".
        const emoji = '<img src="/files/s.png" alt=":say&quot;hi:" data-type="customEmoji" class="emoji">'
        expect(teaserOf(`<p>${emoji}</p>`)).toBe(':say"hi:')
    })
})
