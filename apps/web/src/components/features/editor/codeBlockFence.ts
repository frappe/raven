import type { Editor } from "@tiptap/core"

/** A fenced-code opener typed as a line: ``` or ```lang (trailing spaces ok). */
const FENCE_REGEX = /^```([A-Za-z0-9#+.-]*) *$/

/**
 * If the cursor's paragraph reads exactly ``` or ```lang, replace it with a
 * (language-tagged) code block. Called from the Enter handler: the ``` input
 * rule only fires on a typed SPACE, so on desktop — where plain Enter sends —
 * "```" followed by Enter would post the fence as a message instead of
 * starting a code block.
 */
export const convertFenceLineToCodeBlock = (editor: Editor): boolean => {
    const { selection } = editor.state
    if (!selection.empty) return false
    const $from = selection.$from
    const parent = $from.parent
    if (parent.type.name !== "paragraph") return false
    // Cursor must sit at the end of the fence — Enter mid-text means something else.
    if ($from.parentOffset !== parent.content.size) return false
    const match = FENCE_REGEX.exec(parent.textContent)
    if (!match) return false

    return editor
        .chain()
        .deleteRange({ from: $from.start(), to: $from.end() })
        // "" when no language — falsy, so Tiptap emits no language- class on render.
        .setCodeBlock({ language: match[1] || "" })
        .focus()
        .run()
}
