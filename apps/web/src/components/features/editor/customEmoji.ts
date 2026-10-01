import { Node, mergeAttributes } from "@tiptap/core"
import { fileSrc, sitePath } from "@hooks/useFileSrc"

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
            // Saved as the site path; an address the app made loads only on that device.
            src: { default: null, parseHTML: (element) => sitePath(element.getAttribute("src") ?? "") || null },
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

    // The saved HTML keeps the site path; the editor shows the image through fileSrc.
    addNodeView() {
        return ({ node }) => {
            const dom = document.createElement("img")
            dom.className = "emoji"
            dom.dataset.type = "customEmoji"
            dom.alt = node.attrs.alt ?? ""
            if (node.attrs.src) dom.src = fileSrc(node.attrs.src)
            return { dom }
        }
    },

    /** Plain-text representation (copy / last_message preview) — the shortcode. */
    renderText: ({ node }) => node.attrs.alt ?? "",
})
