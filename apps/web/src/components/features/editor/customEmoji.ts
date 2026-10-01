import { InputRule, Node, mergeAttributes } from "@tiptap/core"
import { getDefaultStore } from "jotai"
import { customEmojiSrcByNameAtom } from "@lib/emojiMart"

/**
 * An inline custom emoji — an atomic image node. Custom emojis have no unicode
 * character, so (unlike standard emojis, which insert as text) they're inserted as
 * this node and serialize to a self-contained `<img data-type="customEmoji" src…>`.
 * The message renderer (RichTextRenderer) shows that image; storing the URL inline
 * means no lookup is needed at render time.
 */
export const CustomEmoji = Node.create({
    name: "customEmoji",
    inline: true,
    group: "inline",
    atom: true,
    selectable: false,
    draggable: false,

    addAttributes() {
        return {
            src: { default: null },
            /** `:emoji_name:` — alt text + what a plain-text copy shows. */
            alt: { default: null },
        }
    },

    parseHTML() {
        return [{ tag: 'img[data-type="customEmoji"]' }]
    },

    renderHTML({ HTMLAttributes }) {
        return ["img", mergeAttributes(HTMLAttributes, { "data-type": "customEmoji", class: "emoji" })]
    },

    /** Plain-text representation (copy, `editor.getText()`) — the shortcode. */
    renderText: ({ node }) => node.attrs.alt ?? "",

    addInputRules() {
        return [
            // Typing `:name:` of a custom emoji inserts that emoji. Not right after a word
            // char or colon, so times and URLs ("10:30:", "a:b:") stay text.
            new InputRule({
                find: /(?<![A-Za-z0-9_:]):([^\s:]+):$/,
                handler: ({ range, match, chain }) => {
                    const src = getDefaultStore().get(customEmojiSrcByNameAtom).get(match[1])
                    if (!src) return null
                    chain().insertContentAt(range, { type: this.name, attrs: { src, alt: match[0] } }).run()
                },
            }),
        ]
    },
})
