import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { textDirection } from "@lib/locale"

/** Blocks that take their direction from their own text. The message renderer uses the same set. */
const AUTO_DIRECTION_NODES = new Set(["paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem"])

/**
 * Each paragraph, list and quote reads in its own language's direction while typing, like
 * the sent message will. An empty paragraph gets no direction, so the caret starts on the
 * interface's side. This only marks the screen: the saved HTML has no dir, so saving an
 * unchanged edit does not mark the message as edited.
 */
export const AutoDirection = Extension.create({
    name: "autoDirection",

    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    decorations: ({ doc }) => {
                        const decorations: Decoration[] = []
                        doc.descendants((node, position) => {
                            const dir = AUTO_DIRECTION_NODES.has(node.type.name) ? textDirection(node.textContent) : undefined
                            if (dir) decorations.push(Decoration.node(position, position + node.nodeSize, { dir }))
                        })
                        return DecorationSet.create(doc, decorations)
                    },
                },
            }),
        ]
    },
})
