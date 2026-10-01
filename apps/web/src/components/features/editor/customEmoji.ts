import { Node, mergeAttributes } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { customEmojiInputTransaction } from "./customEmojiInput"

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

    // A known `:name:` is always the emoji: typed, pasted, or already in a draft or a
    // message being edited.
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("customEmojiInput"),
                appendTransaction: (transactions, _oldState, state) =>
                    transactions.some((tr) => tr.docChanged) ? customEmojiInputTransaction(state, transactions) : null,
            }),
        ]
    },

    onCreate() {
        const tr = customEmojiInputTransaction(this.editor.state)
        if (tr) this.editor.view.dispatch(tr.setMeta("addToHistory", false))
    },
})
