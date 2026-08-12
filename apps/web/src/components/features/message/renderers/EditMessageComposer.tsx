import { useContext, useRef, useState } from "react"
import { FrappeConfig, FrappeContext, useFrappeUpdateDoc } from "frappe-react-sdk"
import { useSetAtom } from "jotai"
import { EditorContent } from "@tiptap/react"
import { linkifyBeforeSend } from "@components/features/editor/linkifyOnSend"
import { Button } from "@components/ui/button"
import { TooltipProvider } from "@components/ui/tooltip"
import { EditorFormattingToolbar } from "@components/features/editor/EditorFormattingToolbar"
import { useRavenEditor, EDITOR_MIN_H } from "@components/features/editor/useRavenEditor"
import { channelMessagesStore } from "@stores/messages/store"
import { editingMessageAtom } from "@utils/channelAtoms"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { errorResponseToast } from "@components/ui/error-banner"
import { useIsMobile } from "@hooks/use-mobile"

type FileLikeMessage = Message & { file?: string }

/**
 * Inline editor shown in place of a message's body while it's being edited (the
 * body renderer swaps to this when `editingMessageAtom` matches). Reuses the shared
 * Tiptap config (mentions/emoji/formatting shortcuts), seeded with the message's
 * current HTML. Save = optimistic `messageEdited` + `update_doc` (backend re-derives
 * content/mentions and flips `is_edited`); a failure reverts. Clearing all text on a
 * text-only message deletes it (v2 behaviour); on a file message it just clears the
 * caption.
 */
export const EditMessageComposer = ({ message }: { message: Message }) => {
    const channelID = message.channel_id
    const messageID = message.name
    const isMobile = useIsMobile()
    const hasFile = !!(message as FileLikeMessage).file
    const setEditing = useSetAtom(editingMessageAtom(channelID))
    const { updateDoc } = useFrappeUpdateDoc()
    const { call } = useContext(FrappeContext) as FrappeConfig

    // Whatever was focused when editing began (e.g. the main composer, after pressing
    // Up to edit) — captured during render, BEFORE this editor autofocuses, so closing
    // can hand focus back and the user keeps typing where they left off.
    const restoreFocusRef = useRef<HTMLElement | null>(null)
    if (restoreFocusRef.current === null && document.activeElement instanceof HTMLElement) {
        restoreFocusRef.current = document.activeElement
    }

    const close = () => {
        setEditing(null)
        // Restore focus after this editor unmounts (next frame), if the target's still there.
        const previous = restoreFocusRef.current
        if (previous) requestAnimationFrame(() => previous.isConnected && previous.focus())
    }

    // submit/cancel are read through refs by the editor's (build-once) keydown closure,
    // so reassigning them each render keeps Enter/Escape calling the latest handlers.
    const submitRef = useRef<() => void>(() => { })
    const cancelRef = useRef<() => boolean>(() => false)
    cancelRef.current = () => {
        close()
        return true // consume Escape so it doesn't also close the thread/drawer
    }

    // ⌘⇧U opens the formatting toolbar's link popover: linkRef bumps a signal the
    // toolbar watches (reset via onLinkConsumed so re-renders don't reopen it).
    const [linkSignal, setLinkSignal] = useState(0)
    const linkRef = useRef<() => void>(() => { })
    linkRef.current = () => setLinkSignal((n) => n + 1)

    const editor = useRavenEditor({
        submitRef,
        cancelReplyRef: cancelRef,
        linkRef,
        content: message.text,
        autofocus: true,
        placeholder: _("Edit message..."),
    })

    const onSave = () => {
        if (!editor) return
        // Same send-time linkify as ChatInput — edits paste links on mobile too.
        if (!editor.isEmpty) linkifyBeforeSend(editor)
        const newHTML = editor.isEmpty ? "" : editor.getHTML()
        close()

        // No change → nothing to do.
        if (newHTML === (message.text ?? "")) return

        // Cleared a text-only message → delete it (a file message just loses its caption).
        if (!newHTML && !hasFile) {
            const snapshot = channelMessagesStore.getState(channelID).byId.get(messageID)
            channelMessagesStore.messageDeleted(channelID, messageID)
            call.post("raven.api.raven_message.delete_messages", { message_ids: [messageID] }).catch((e) => {
                if (snapshot) channelMessagesStore.messagesRestored(channelID, [snapshot])
                errorResponseToast(_("Could not delete message"), e)
            })
            return
        }

        // Optimistic edit — the body renders `text`; `content` is corrected by the echo.
        const prev = channelMessagesStore.getState(channelID).byId.get(messageID)
        channelMessagesStore.messageEdited(channelID, messageID, { text: newHTML, is_edited: 1 })
        updateDoc("Raven Message", messageID, { text: newHTML }).catch((e) => {
            if (prev) {
                channelMessagesStore.messageEdited(channelID, messageID, {
                    text: prev.text,
                    content: prev.content,
                    is_edited: prev.is_edited,
                })
            }
            errorResponseToast(_("Could not edit message"), e)
        })
    }
    submitRef.current = onSave

    return (
        <div data-raven-editor className="relative w-full py-1">
            {/* bg-surface-base (not white) so the box stays distinct from the message
                row's grey hover. overflow-y-hidden keeps the formatting toolbar's
                square top corners inside the rounded border. */}
            <div className="w-full overflow-y-hidden rounded-lg border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-3">
                <TooltipProvider>
                    {/* Same formatting toolbar as the main composer, so editing has the
                        full bold/italic/list/link set rather than shortcuts only. */}
                    {editor && !isMobile && (
                        <EditorFormattingToolbar
                            editor={editor}
                            linkSignal={linkSignal}
                            onLinkConsumed={() => setLinkSignal(0)}
                        />
                    )}
                    <div className={EDITOR_MIN_H}>
                        <EditorContent editor={editor} />
                    </div>
                    <div className="flex items-center md:justify-start justify-end gap-2 px-1.5 pb-1.5">
                        <span className="mr-auto px-1 text-xs text-ink-gray-4 hidden md:block">{_("Esc to cancel")}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={close}>
                            {_("Cancel")}
                        </Button>
                        <Button type="button" variant="solid" size="sm" onClick={onSave}>
                            {_("Save")}
                        </Button>
                    </div>
                </TooltipProvider>
            </div>
        </div>
    )
}
