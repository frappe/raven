import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { EditorState } from "@tiptap/pm/state"
import { getDefaultStore } from "jotai"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import { CustomEmoji } from "./customEmoji"
import { Spoiler } from "./spoiler"
import { customEmojiInputTransaction, isInCode } from "./customEmojiInput"

const schema = getSchema([StarterKit, CustomEmoji, Spoiler])
const emoji = (name: string) => schema.nodes.customEmoji.create({ src: `/files/${name}.png`, alt: `:${name}:` })
const text = (value: string, code = false) => schema.text(value, code ? [schema.marks.code.create()] : [])
// Casts: @tiptap/core and @tiptap/pm/state resolve to different prosemirror-model copies.
const stateOf = (...inline: ReturnType<typeof text>[]) =>
    EditorState.create({
        schema: schema as never,
        doc: schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, inline)) as never,
    })

/** The paragraph as text, with each custom emoji as [name]. */
const show = (state: EditorState) => {
    let out = ""
    state.doc.descendants((node) => {
        if (node.isText) out += node.marks.length ? `<code>${node.text}</code>` : node.text
        else if (node.type.name === "customEmoji") out += `[${node.attrs.alt.slice(1, -1)}]`
    })
    return out
}

/** Apply `edit` to `state`, then the plugin's follow-up, like appendTransaction does. */
const run = (state: EditorState, edit?: (tr: ReturnType<EditorState["tr"]["insertText"]>) => void) => {
    const tr = state.tr
    edit?.(tr)
    const next = state.apply(tr)
    const follow = customEmojiInputTransaction(next, [tr])
    return follow ? next.apply(follow) : next
}

getDefaultStore().set(customEmojiCategoriesAtom, [
    {
        id: "raven",
        name: "Custom",
        emojis: [{ id: "party", name: "party", keywords: [], skins: [{ src: "/files/party.png" }] }],
    },
])

describe("customEmojiInputTransaction", () => {
    it("leaves a shortcode after an unclosed backtick, so inline code can close", () => {
        expect(show(run(stateOf(text("run `:party")), (tr) => tr.insertText(":", 12)))).toBe("run `:party:")
    })

    it("keeps a closed pair of backticks", () => {
        expect(show(run(stateOf(text("`a` and :party")), (tr) => tr.insertText(":", 15)))).toBe("`a` and [party]")
    })

    it("drops the backtick before an emoji the popup inserts", () => {
        expect(show(run(stateOf(text("hi `")), (tr) => tr.insert(5, emoji("party") as never)))).toBe("hi [party]")
    })

    it("leaves a backtick typed before an existing emoji", () => {
        expect(show(run(stateOf(text("hi "), emoji("party")), (tr) => tr.insertText("`", 4)))).toBe("hi `[party]")
    })

    it("keeps the replaced text's marks on the emoji", () => {
        // An edited message or old draft can hold <span data-spoiler>:party: secret</span>.
        // The swap must not pull the emoji out of the spoiler.
        const spoilered = schema.text(":party: secret", [schema.marks.spoiler.create()])
        const state = stateOf(spoilered)
        // No transactions: the onCreate full-document pass.
        const follow = customEmojiInputTransaction(state)
        const next = follow ? state.apply(follow) : state
        const marks: Record<string, string[]> = {}
        next.doc.descendants((node) => {
            if (node.type.name === "customEmoji") marks.emoji = node.marks.map((mark) => mark.type.name)
            if (node.isText) marks.text = node.marks.map((mark) => mark.type.name)
        })
        expect(marks.emoji).toEqual(["spoiler"])
        expect(marks.text).toEqual(["spoiler"])
    })

    it("leaves :name: in inline code as text", () => {
        const state = stateOf(text("x "), text(":party:", true))
        expect(show(run(state, (tr) => tr.insertText("y", 2)))).toBe("xy <code>:party:</code>")
        expect(isInCode(state, 3)).toBe(true)
        expect(isInCode(state, 1)).toBe(false)
    })
})
