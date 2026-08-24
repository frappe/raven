import { Mark, markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core"

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        spoiler: {
            setSpoiler: () => ReturnType
            toggleSpoiler: () => ReturnType
            unsetSpoiler: () => ReturnType
        }
    }
}

// Discord-style `||text||`. Mirrors StarterKit's bold rule (`**text**`) but with pipes.
const inputRegex = /(?:^|\s)(\|\|(?!\s+\|\|)((?:[^|]+))\|\|)$/
const pasteRegex = /(?:^|\s)(\|\|(?!\s+\|\|)((?:[^|]+))\|\|)/g

/**
 * Spoiler mark — hides text until the reader clicks it. Serialized as
 * `<span data-spoiler class="spoiler">`; the message renderer (RichTextRenderer)
 * swaps that for an interactive click-to-reveal component, while the composer shows
 * it as a subtle pill so the writer can see what they've marked. `data-spoiler` is
 * the parse contract (survives the renderer's class-strip, like mentions' data-*).
 */
export const Spoiler = Mark.create({
    name: "spoiler",

    parseHTML() {
        return [{ tag: "span[data-spoiler]" }]
    },

    renderHTML({ HTMLAttributes }) {
        return ["span", mergeAttributes(HTMLAttributes, { "data-spoiler": "true", class: "spoiler" }), 0]
    },

    addCommands() {
        return {
            setSpoiler: () => ({ commands }) => commands.setMark(this.name),
            toggleSpoiler: () => ({ commands }) => commands.toggleMark(this.name),
            unsetSpoiler: () => ({ commands }) => commands.unsetMark(this.name),
        }
    },

    addInputRules() {
        return [markInputRule({ find: inputRegex, type: this.type })]
    },

    addPasteRules() {
        return [markPasteRule({ find: pasteRegex, type: this.type })]
    },
})
