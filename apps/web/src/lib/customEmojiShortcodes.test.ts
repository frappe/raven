import { describe, expect, it } from "vitest"
import { splitCustomEmojiShortcodes } from "@lib/customEmojiShortcodes"
import { shortcodesFor } from "@lib/customEmojiShortcodes.fixtures"

const emoji = (name: string) => ({ shortcode: `:${name}:`, src: `/files/${name}.png` })

describe("splitCustomEmojiShortcodes", () => {
    const shortcodes = shortcodesFor("party", "what?", ":finding:", "party parrot", "café")

    it("splits known shortcodes out of the text", () => {
        expect(splitCustomEmojiShortcodes("hi :party: there", shortcodes)).toEqual(["hi ", emoji("party"), " there"])
    })

    it("handles any name", () => {
        expect(splitCustomEmojiShortcodes(":what?: ::finding:: :party parrot: :café:", shortcodes)).toEqual([
            emoji("what?"),
            " ",
            emoji(":finding:"),
            " ",
            emoji("party parrot"),
            " ",
            emoji("café"),
        ])
    })

    it("matches adjacent shortcodes", () => {
        // Pasted or bot-sent text arrives whole; both must convert.
        expect(splitCustomEmojiShortcodes(":party::party:", shortcodes)).toEqual([emoji("party"), emoji("party")])
    })

    it("leaves unknown names, times and words before a colon as text", () => {
        expect(splitCustomEmojiShortcodes(":nope: 10:30: a:party:", shortcodes)).toBeNull()
    })

    it("needs a known emoji", () => {
        expect(splitCustomEmojiShortcodes("hi :party:", null)).toBeNull()
        expect(shortcodesFor()).toBeNull()
    })
})
