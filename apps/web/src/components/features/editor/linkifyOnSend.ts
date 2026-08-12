import type { Editor } from "@tiptap/react"
import { find } from "linkifyjs"

/**
 * Mark any URL-shaped text that ISN'T already a link, right before a message
 * is serialized for sending.
 *
 * Why this exists: tiptap has two live linkification paths and mobile slips
 * between both. `linkOnPaste` needs a real ClipboardEvent — but Android
 * keyboards (Gboard's clipboard chip, suggestion-strip paste) insert clipboard
 * text through IME `insertText`, which never fires one. And `autolink`
 * deliberately skips the word the caret sits at the end of (it linkifies on
 * the DELIMITER keystroke, so it doesn't fire mid-word) — and the mobile flow
 * is paste → send, no trailing space ever typed. A send-time sweep catches
 * every entry path: IME paste, dictation, autocomplete.
 *
 * Uses linkifyjs — the same matcher tiptap's autolink uses — so what gets
 * linked here is exactly what WOULD have been linked had the user typed a
 * space. Skips code (block + inline mark) and anything already linked.
 */
export const linkifyBeforeSend = (editor: Editor) => {
    const { doc, schema } = editor.state
    const linkMark = schema.marks.link
    if (!linkMark) return

    const additions: { from: number; to: number; href: string }[] = []
    doc.descendants((node, pos, parent) => {
        if (!node.isText || !node.text) return
        if (parent?.type.name === "codeBlock") return
        if (node.marks.some((mark) => mark.type.name === "link" || mark.type.name === "code")) return
        for (const match of find(node.text, { defaultProtocol: "https" })) {
            if (!match.isLink) continue
            additions.push({ from: pos + match.start, to: pos + match.end, href: match.href })
        }
    })
    if (additions.length === 0) return

    const tr = editor.state.tr
    for (const { from, to, href } of additions) {
        tr.addMark(from, to, linkMark.create({ href }))
    }
    editor.view.dispatch(tr)
}
