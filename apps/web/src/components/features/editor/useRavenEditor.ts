import { useEditor, type Editor } from "@tiptap/react"
import type { AnyExtension } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { Link } from "@tiptap/extension-link"
import { Highlight } from "@tiptap/extension-highlight"
import { TableKit } from "@tiptap/extension-table"
import { Placeholder } from "@tiptap/extensions"
import { FileHandler } from "@tiptap/extension-file-handler"
import { useRef, type MutableRefObject } from "react"
import { useAtomValue } from "jotai"
import { useIsMobile } from "@hooks/use-mobile"
import { EnterKeyBehaviourAtom } from "@utils/preferences"
import { UserMention } from "./userMention"
import { ChannelMention } from "./channelMention"
import { CustomEmoji } from "./customEmoji"
import { Spoiler } from "./spoiler"
import { EmojiSuggestion } from "./emoji"
import { isSuggestionPopupOpen } from "./suggestion"
import { convertFenceLineToCodeBlock } from "./codeBlockFence"

/**
 * The one Tiptap configuration shared by every place we edit a message — the main
 * composer, inline message editing, thread replies. Centralising it here means
 * extensions (mentions, emoji, formatting — added in later layers) and behaviour
 * (Enter to submit, styling) stay identical everywhere instead of being re-declared.
 *
 * The caller owns the submit handler and passes it via a ref: the editor's keydown
 * closure is built once, so reading `submitRef.current` lets it always call the
 * caller's latest handler (which closes over fresh state) without rebuilding the editor.
 */
interface UseRavenEditorOptions {
    /** Invoked on Enter (without Shift). Shift+Enter inserts a newline. */
    submitRef: MutableRefObject<() => void>
    /** Invoked on Mod+Shift+U — the caller reveals the formatting toolbar + opens the link popover. */
    linkRef?: MutableRefObject<() => void>
    /** Invoked when files are pasted/dropped into the editor (omit to disable, e.g. inline edit). */
    filesRef?: MutableRefObject<(files: File[]) => void>
    /**
     * Try to cancel the active reply. Called on Escape, and on Backspace when the
     * editor is empty. Returns true if it cancelled something (so the key is consumed),
     * false otherwise (key falls through to default behaviour).
     */
    cancelReplyRef?: MutableRefObject<() => boolean>
    /**
     * Try to edit the last message (Up arrow on an EMPTY editor). Returns true if it
     * started an edit (key consumed), false otherwise. The main composer wires this;
     * the inline editor omits it (no "edit previous" while already editing).
     */
    editLastRef?: MutableRefObject<() => boolean>
    /** Initial HTML — set when editing an existing message; omit for a blank composer. */
    content?: string
    /** Autofocus on mount (e.g. inline edit). Off by default for the composer. */
    autofocus?: boolean
    /** Empty-state hint shown in the editor (omit to show nothing, e.g. inline edit). */
    placeholder?: string
}

/** Shared editor surface styling — the `.tiptap` class is the render/compose source of truth. */
/**
 * The editor surface's min-height — shorter on mobile to spare screen space, taller on
 * desktop. Exported so the composer can reserve the SAME height before the editor
 * mounts (EditorContent renders empty until then), keeping the composer — and thus the
 * message stream's height — from jumping on channel open. Both must use this exact
 * value or the reservation won't match.
 */
export const EDITOR_MIN_H = "min-h-14 md:min-h-16"

const EDITOR_CLASS = `tiptap ${EDITOR_MIN_H} max-h-[40vh] overflow-y-auto px-3 py-2.5 focus:outline-none`

export const useRavenEditor = ({ submitRef, linkRef, filesRef, cancelReplyRef, editLastRef, content, autofocus = false, placeholder }: UseRavenEditorOptions): Editor | null => {
    // Emoji `:` autocomplete is desktop-only — mobile keyboards have their own emoji,
    // and a popup on every ":" is noise. Captured at mount (a breakpoint flip
    // mid-session won't reconfigure the live editor, which is fine).
    const isMobile = useIsMobile()

    // The keydown closure is built once, so read the live Enter-key preference and the
    // editor instance through refs (kept current each render) instead of closing over
    // stale values.
    const enterBehaviour = useAtomValue(EnterKeyBehaviourAtom)
    const enterBehaviourRef = useRef(enterBehaviour)
    enterBehaviourRef.current = enterBehaviour
    const editorRef = useRef<Editor | null>(null)

    // StarterKit already covers bold/italic/strike/underline, code + code blocks,
    // lists, blockquote, hr, link, undo/redo — all round-tripped by the message
    // renderer. We add Highlight (==text==) and tables, and configure Link for chat
    // (don't navigate on click in the editor; auto-link typed/pasted URLs). Headings
    // are disabled — not wanted in chat.
    //
    // FileHandler (paste/drop → upload as attachments) is added only when the caller
    // wires filesRef — the composer does, inline edit doesn't.
    //
    // Deliberately NOT added: text-align + headings (not wanted), code-block-lowlight
    // (StarterKit's code block is enough; the renderer highlights on display — avoids
    // eager highlight.js in the composer bundle), Image (attachments are file
    // messages, not inline), Details/TaskList (no renderer+CSS yet).
    const extensions: AnyExtension[] = [
        StarterKit.configure({
            heading: false,
            link: false, // replaced below with a non-inclusive variant
        }),
        // Link with `inclusive: false`: stock Link makes the mark inclusive when
        // autolink is on, so a PASTED link swallowed everything typed after it
        // (spaces included) until the caret was arrow-keyed out. Non-inclusive
        // stops the mark at its boundary; autolinking of typed URLs still works —
        // the autolink plugin re-matches the word on each keystroke by itself.
        Link.extend({ inclusive: false }).configure({
            openOnClick: false,
            autolink: true,
            defaultProtocol: "https",
        }),
        Highlight,
        TableKit,
        UserMention,
        ChannelMention,
        CustomEmoji,
        Spoiler,
    ]
    if (placeholder) extensions.push(Placeholder.configure({ placeholder }))
    if (filesRef) {
        // Paste files into the editor → hand them to the caller's upload path (same as
        // the attach button). Pasted text isn't affected: the plugin only fires this
        // when the clipboard actually carries files. Drops are handled at the pane
        // level (FileDropZone) so the whole channel is a drop target, not just here.
        extensions.push(
            FileHandler.configure({
                onPaste: (_editor, files) => { if (files.length) filesRef.current(files) },
            }),
        )
    }
    if (!isMobile) extensions.push(EmojiSuggestion)

    const editor = useEditor({
        extensions,
        content,
        // Never steal focus on mobile — it pops the on-screen keyboard the moment a
        // channel opens. Desktop honours the caller's request, focusing at the END so a
        // restored draft (or an edited message) puts the cursor after the text, not before it.
        autofocus: isMobile ? false : autofocus ? "end" : false,
        editorProps: {
            attributes: {
                class: EDITOR_CLASS,
            },
            handleKeyDown: (_view, event) => {
                // Mod+Shift+U: hand off to the caller (reveal toolbar + open link popover).
                // Not Mod+K — that's reserved for the global command palette. Plain Mod+U
                // stays underline (handled by the Underline extension).
                if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "u") {
                    if (linkRef) {
                        event.preventDefault()
                        linkRef.current()
                        return true
                    }
                }

                // Escape cancels the active reply (but let an open suggestion popup take it).
                // When it DOES cancel, stop propagation so the same Escape doesn't also close
                // a drawer / the thread (those listen at the document). When there's nothing to
                // cancel we return false WITHOUT stopping it, so Escape bubbles up and the
                // drawer/thread hotkey can handle it.
                if (event.key === "Escape") {
                    if (isSuggestionPopupOpen()) return false
                    if (cancelReplyRef?.current()) {
                        event.preventDefault()
                        event.stopPropagation()
                        return true
                    }
                    return false
                }

                // Up arrow on an EMPTY editor → edit the last message (Slack-style). Gated
                // on empty so it never hijacks caret navigation within a draft, and lets a
                // suggestion popup take Up to move its selection.
                // Do not trigger this if the user is typing in the editor or switching channels
                if (event.key === "ArrowUp" && editLastRef && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
                    if (isSuggestionPopupOpen()) return false
                    if (editorRef.current?.isEmpty && editLastRef.current()) {
                        event.preventDefault()
                        return true
                    }
                    return false
                }

                // Select-all then delete (Backspace/Delete): clear to a fresh empty doc.
                // Deleting a whole-document selection can otherwise leave a lingering
                // selection highlight on the now-empty editor instead of collapsing to a
                // plain cursor. Note Ctrl/⌘+A is a *native* selection → ProseMirror sees a
                // TextSelection over the text (≈ pos 1 … size-1), NOT an AllSelection at
                // 0 … size — so match "covers essentially all content", not exact bounds.
                if (event.key === "Backspace" || event.key === "Delete") {
                    const ed = editorRef.current
                    const sel = ed?.state.selection
                    const size = ed?.state.doc.content.size ?? 0
                    if (ed && sel && !sel.empty && sel.from <= 1 && sel.to >= size - 1) {
                        // clearContent normalises the doc; focus("start") lands a clean
                        // collapsed caret, syncing the DOM selection so no highlight remains.
                        ed.chain().clearContent(true).focus("start").run()
                        event.preventDefault()
                        return true
                    }
                }

                // Backspace in an empty composer cancels the active reply (v2 parity).
                if (event.key === "Backspace") {
                    if (editorRef.current?.isEmpty && cancelReplyRef?.current()) {
                        event.preventDefault()
                        return true
                    }
                    return false
                }

                if (event.key === "Enter") {
                    // A suggestion popup (@mention / #channel / :emoji:) is showing → let it
                    // take Enter to pick the highlighted item. This handler runs before the
                    // suggestion plugin, so without this it would swallow Enter first.
                    if (isSuggestionPopupOpen()) return false

                    const ed = editorRef.current

                    // Shift+Enter is always a newline — a PARAGRAPH split (Enter's own
                    // default chain), matching what plain Enter already produces on
                    // mobile and in new-line mode. It used to insert a hard break,
                    // which packed every visual line into ONE paragraph — silently
                    // killing every block input rule mid-message (``` / "- " / "> "
                    // all anchor to block start) and making toggleCodeBlock swallow
                    // the lines above the cursor. Renders identically: .tiptap p has
                    // no margin, so split paragraphs stack as tight as <br> lines.
                    if (event.shiftKey) {
                        if (!ed) return false
                        const handled = ed.commands.first(({ commands }) => [
                            () => commands.newlineInCode(), // inside a code block: plain \n
                            () => commands.createParagraphNear(),
                            () => commands.liftEmptyBlock(),
                            () => commands.splitBlock(), // in a list: new line WITHIN the item (Enter makes a new item)
                        ])
                        if (handled) {
                            event.preventDefault()
                            return true
                        }
                        return false
                    }

                    // A paragraph reading exactly ``` (or ```lang) becomes a code block
                    // on Enter — the input rule only fires on a typed space, and in
                    // send-message mode this Enter would otherwise SEND the fence.
                    // Checked before the mobile branch so it works there too.
                    if (!event.metaKey && !event.ctrlKey && ed && convertFenceLineToCodeBlock(ed)) {
                        event.preventDefault()
                        return true
                    }

                    // Mobile: Enter always inserts a newline; the send button submits.
                    if (isMobile) return false

                    // Cmd/Ctrl+Enter always sends — the reliable "send" chord everywhere,
                    // including code blocks and lists.
                    if (event.metaKey || event.ctrlKey) {
                        event.preventDefault()
                        submitRef.current()
                        return true
                    }

                    // Plain Enter sends only in "send-message" mode — and not while inside a
                    // code block or list, where Enter must add a line / list item (use
                    // Cmd+Enter to send from there). In "new-line" mode Enter is a newline.
                    if (enterBehaviourRef.current === "send-message") {
                        if (ed?.isActive("codeBlock") || ed?.isActive("listItem")) return false
                        event.preventDefault()
                        submitRef.current()
                        return true
                    }
                    return false
                }
                return false
            },
        },
    })

    editorRef.current = editor
    return editor
}
