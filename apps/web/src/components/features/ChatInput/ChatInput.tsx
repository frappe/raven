import { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, useEditorState } from "@tiptap/react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { selectAtom } from "jotai/utils"
import { useDebounceCallback } from "usehooks-ts"
import { toast } from "sonner"
import { Type, Lock } from "lucide-react"
import { InputFileList, AddFileButton } from "./InputFiles"
import SendButton from "./SendButton"
import { MentionButton } from "./MentionButton"
import { EmojiPickerButton } from "./EmojiPickerButton"
import { CreatePollDialog } from "./CreatePollDialog"
import { uploadedFilesAtom, uploadingFilesAtom, pendingSendAtom, useAttachFile } from "./useFileInput"
import { registerComposerFocus } from "./composerFocus"
import { useRavenEditor, EDITOR_MIN_H } from "@components/features/editor/useRavenEditor"
import { EditorFormattingToolbar } from "@components/features/editor/EditorFormattingToolbar"
import { ReplyPreviewBanner } from "./ReplyPreviewBanner"
import { MentionWarningBanner } from "./MentionWarningBanner"
import { MobileComposerActions } from "./MobileComposerActions"
import { loadDraft, saveDraft } from "./draft"
import { useIsMobile } from "@hooks/use-mobile"
import { enqueueSend } from "@stores/messages/messageSender"
import { editingMessageAtom, replyToMessageAtom } from "@utils/channelAtoms"
import { getLastEditableMessage } from "@components/features/message/actions/editTarget"
import { useChannelById } from "@stores/channels/useChannelList"
import { isInReadOnlyMode } from "@lib/frappe"
import { useUserCookieData } from "@hooks/useUserCookieData"
import _ from "@lib/translate"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { Separator } from "@components/ui/separator"
import AttachFrappeDocumentDialog from "./AttachFrappeDocumentDialog"

interface ChatInputProps {
    channelID: string
    /**
     * Override DM detection (controls the mention warning banner). A thread composer
     * passes its PARENT's DM status, since the thread channel itself isn't in the
     * channel store and would otherwise read as a non-DM.
     */
    isDirectMessage?: boolean,
    /** Send in the parentChannelID of the thread if it is a thread */
    parentChannelID?: string | null,
}

/**
 * The message composer.
 *
 * On send, we show the message on screen right away (attachments first, then text,
 * all sharing one client_id so they group together), clear the input, then send to
 * the server. The server's response is the source of truth: it replaces the
 * shown-immediately message with the real one. A failure marks it failed with inline
 * Retry / Discard.
 *
 * Hold-for-uploads: if the user sends while files are still uploading, we don't drop
 * them — we mark the send as waiting and send it automatically once every upload
 * finishes (pendingSendAtom). The actual send (dispatchSend) is split out so the
 * normal path and the waiting path share one implementation.
 */
const ChatInput = forwardRef<HTMLFormElement, ChatInputProps>(({ channelID, isDirectMessage, parentChannelID }, ref) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const [files, setFiles] = useAtom(uploadedFilesAtom(channelID))
    const [pendingSend, setPendingSend] = useAtom(pendingSendAtom(channelID))
    const [replyTo, setReplyTo] = useAtom(replyToMessageAtom(channelID))
    const { name: currentUser } = useUserCookieData()
    const isMobile = useIsMobile()
    // The mention warning banner (on-leave / non-member) is channel-only — DMs and DM
    // threads have no membership to manage and you're talking to one person already.
    // A thread composer passes isDirectMessage (its parent's status) since the thread
    // channel isn't in the store; otherwise self-detect from the channel.
    const channelIsDM = useChannelById(channelID)?.is_direct_message === 1
    const isDM = isDirectMessage ?? channelIsDM

    // Restore any saved draft once on mount. ChatInput is keyed by channel, so this
    // reads the right channel's draft on every channel switch.
    const [initialDraft] = useState(() => loadDraft(channelID))

    // Formatting toolbar visibility — off by default (clean composer), toggled by
    // the Type button in the action bar.
    const [showFormatting, setShowFormatting] = useState(false)
    // Bumped by the ⌘⇧U shortcut to open the link popover (also reveals the toolbar).
    const [linkSignal, setLinkSignal] = useState(0)

    // The editor's keydown/paste closures (built once) call the latest handlers via these refs.
    const sendRef = useRef<() => void>(() => { })
    const linkRef = useRef<() => void>(() => { })
    linkRef.current = () => {
        setShowFormatting(true)
        setLinkSignal((n) => n + 1)
    }
    const onAddFile = useAttachFile(channelID)
    const filesRef = useRef<(files: File[]) => void>(() => { })
    filesRef.current = onAddFile
    // Escape / Backspace-when-empty cancel the active reply (reads the latest replyTo).
    const cancelReplyRef = useRef<() => boolean>(() => false)
    cancelReplyRef.current = () => {
        if (!replyTo) return false
        setReplyTo(null)
        return true
    }

    // Up-arrow on the empty composer edits your last message — when it's editable.
    const setEditing = useSetAtom(editingMessageAtom(channelID))
    const editLastRef = useRef<() => boolean>(() => false)
    editLastRef.current = () => {
        const target = getLastEditableMessage(channelID, currentUser)
        if (!target) return false
        setEditing(target.name)
        return true
    }

    // A held send waits on these: any file still uploading blocks dispatch; an
    // errored upload settles but must not be silently sent without. We subscribe
    // to just these booleans (not the array) so per-tick upload-progress updates
    // don't re-render this component — and with it the editor — on every percent.
    const hasUploadsInFlight = useAtomValue(
        useMemo(() => selectAtom(uploadingFilesAtom(channelID), (f) => f.some((file) => file.status === "uploading")), [channelID]),
    )
    const hasFailedUploads = useAtomValue(
        useMemo(() => selectAtom(uploadingFilesAtom(channelID), (f) => f.some((file) => file.status === "error")), [channelID]),
    )

    const editor = useRavenEditor({ submitRef: sendRef, linkRef, filesRef, cancelReplyRef, editLastRef, content: initialDraft || undefined, autofocus: true, placeholder: _("Type a message...") })

    // Persist the draft as the user types (debounced). Stable callback so the
    // debounced instance — and its flush() on unmount — stay identity-stable.
    const persistDraft = useDebounceCallback(
        useCallback(() => {
            if (!editor) return
            saveDraft(channelID, editor.isEmpty ? "" : editor.getHTML())
        }, [editor, channelID]),
        500,
    )

    useEffect(() => {
        if (!editor) return
        editor.on("update", persistDraft)
        return () => {
            editor.off("update", persistDraft)
            // Switching channels unmounts this — write the latest text now so it isn't
            // lost in the debounce window.
            persistDraft.flush()
        }
    }, [editor, persistDraft])

    /** Build the optimistic batch, clear the composer, and fire the request. */
    const dispatchSend = useCallback(() => {
        if (!editor) return
        const isEmpty = editor.isEmpty
        if (isEmpty && files.length === 0) return

        const content = isEmpty ? "" : editor.getHTML()
        const outgoingFiles = files.map((f) => ({ file_url: f.fileURL, file_size: f.size }))
        const batchId = crypto.randomUUID()

        // Reply context: send the linked message id + a snapshot of it so the reply
        // preview renders immediately (the snapshot matches ReplyMessage's expected shape).
        const linkedMessage = replyTo?.name
        const repliedMessageDetails = replyTo
            ? JSON.stringify({
                text: replyTo.text ?? "",
                content: replyTo.content ?? "",
                file: (replyTo as typeof replyTo & { file?: string }).file ?? "",
                message_type: replyTo.message_type,
                owner: replyTo.owner,
                creation: replyTo.creation,
            })
            : undefined

        // Shows the message on screen, saves it to the outbox, then sends it.
        enqueueSend(call, { channelID, batchId, owner: currentUser, content, files: outgoingFiles, linkedMessage, repliedMessageDetails })

        // Clear the composer right away — the message is already on screen
        editor.commands.clearContent()
        setFiles([])
        if (replyTo) setReplyTo(null)
        // Drop the saved draft (and any pending debounced write of the old text).
        persistDraft.cancel()
        saveDraft(channelID, "")
        editor.commands.focus()
    }, [editor, files, channelID, currentUser, call, setFiles, replyTo, setReplyTo, persistDraft])

    const handleSend = useCallback(() => {
        if (!editor) return
        // Nothing to send — no text, no uploaded files, nothing staged (uploading or errored).
        if (editor.isEmpty && files.length === 0 && !hasUploadsInFlight && !hasFailedUploads) return

        // Files are still uploading: hold the send. An effect dispatches it once
        // every upload settles, so the in-flight files aren't dropped.
        if (hasUploadsInFlight) {
            setPendingSend(true)
            return
        }

        dispatchSend()
    }, [editor, files, hasUploadsInFlight, hasFailedUploads, dispatchSend, setPendingSend])

    // Held send: once uploads settle, dispatch (or back off if any failed so the
    // user can remove the bad file and retry — we never send silently without it).
    useEffect(() => {
        if (!pendingSend || hasUploadsInFlight) return
        setPendingSend(false)
        if (hasFailedUploads) {
            toast.error(_("Some files failed to upload. Remove them and send again."))
            return
        }
        dispatchSend()
    }, [pendingSend, hasUploadsInFlight, hasFailedUploads, dispatchSend, setPendingSend])

    useEffect(() => {
        sendRef.current = handleSend
    }, [handleSend])

    // When a reply is started (from a message's Reply action), focus the composer.
    useEffect(() => {
        if (replyTo) editor?.commands.focus()
    }, [replyTo, editor])

    // Expose this channel's composer focus so the pane-level FileDropZone (and any other
    // attach path outside this subtree) can refocus the editor after a drop.
    useEffect(() => {
        if (!editor) return
        return registerComposerFocus(channelID, () => editor.commands.focus())
    }, [channelID, editor])

    const cancelReply = useCallback(() => {
        setReplyTo(null)
        editor?.commands.focus()
    }, [setReplyTo, editor])

    // The set of @-mentioned user ids in the draft, as a stable joined string so this
    // only re-renders when the mention set changes (not on every keystroke). Drives
    // the on-leave / non-member warning banner.
    const mentionedKey = useEditorState({
        editor,
        selector: ({ editor }) => {
            if (!editor) return ""
            const ids = new Set<string>()
            editor.state.doc.descendants((node) => {
                if (node.type.name === "userMention" && node.attrs.id) ids.add(node.attrs.id as string)
            })
            return Array.from(ids).sort().join(",")
        },
    })
    const mentionedIds = useMemo(() => (mentionedKey ? mentionedKey.split(",") : []), [mentionedKey])

    // Read-only mode (e.g. the site is mid-update): block sending entirely and explain
    // why, in place of the composer. Checked after the hooks above so we don't break
    // the hooks order. App-wide write-blocking is a later, broader effort.
    if (isInReadOnlyMode()) {
        return (
            <div className="px-3 pb-4 w-full">
                <div className="flex items-center justify-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-3 text-sm text-ink-gray-6">
                    <Lock className="size-3 shrink-0" />
                    <span>{_("The site is in read-only mode right now. Please wait while the site is being updated.")}</span>
                </div>
            </div>
        )
    }

    return (
        <form
            ref={ref}
            onSubmit={(e) => {
                e.preventDefault()
                handleSend()
            }}
            className="px-3 pb-3 w-full flex flex-col gap-2"
        >
            {/* Warning banner is only shown for primary channels, not DMs, threads in DMs. */}
            {!isDM && mentionedIds.length > 0 && <MentionWarningBanner channelID={parentChannelID ?? channelID} mentionedIds={mentionedIds} isThread={parentChannelID ? true : false} />}
            {/* Outer wrapper carries data-raven-editor and is the popup anchor: the
                mention/emoji/#/: popups append here and sit `bottom-full` (ABOVE the box),
                so they must NOT be clipped. The inner box keeps overflow-y-hidden so the
                formatting toolbar's square top corners stay within the rounded border. */}
            <div data-raven-editor className="relative w-full">
                <div className="w-full rounded-lg border border-outline-gray-2 shadow-outline-base bg-surface-white focus-within:border-outline-gray-3 overflow-y-hidden">
                    <TooltipProvider>

                        {editor && showFormatting && (
                            <EditorFormattingToolbar
                                editor={editor}
                                linkSignal={linkSignal}
                                onLinkConsumed={() => setLinkSignal(0)}
                            />
                        )}
                        {replyTo && <ReplyPreviewBanner message={replyTo} onCancel={cancelReply} showFormatting={showFormatting} />}
                        <InputFileList channelID={channelID} />
                        {/* Reserve the editor's min-height before it mounts (EditorContent is
                            empty until `editor` is ready) so the composer — and the stream's
                            height — don't jump on channel open. Same class as the editor surface. */}
                        <div className={EDITOR_MIN_H}>
                            <EditorContent editor={editor} />
                        </div>
                        <div className="flex items-center gap-1 px-1 pb-1">
                            {isMobile ? (
                                // Mobile: secondary actions collapse into a "+" bottom sheet.
                                <MobileComposerActions channelID={channelID} onToggleFormatting={() => setShowFormatting((v) => !v)} />
                            ) : (
                                <>
                                    <AddFileButton channelID={channelID} onAfterAttach={() => editor?.commands.focus()} />
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                isIconButton
                                                aria-label={_("Formatting")}
                                                aria-pressed={showFormatting}
                                                onClick={() => {
                                                    setShowFormatting((v) => !v)
                                                    editor?.commands.focus()
                                                }}
                                                className={cn(showFormatting && "bg-surface-gray-3 text-ink-gray-9")}
                                            >
                                                <Type />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{_("Formatting")}</TooltipContent>
                                    </Tooltip>
                                    <Separator orientation="vertical" className="mx-1 h-4!" />
                                    {editor && <MentionButton editor={editor} />}
                                    {editor && <EmojiPickerButton editor={editor} />}
                                    <Separator orientation="vertical" className="mx-1 h-4!" />
                                    <CreatePollDialog channelID={channelID} />
                                    <AttachFrappeDocumentDialog />
                                </>
                            )}
                            <div className="flex-1" />
                            <SendButton onSend={handleSend} loading={pendingSend} />
                        </div>
                    </TooltipProvider>
                </div>
            </div>
        </form>
    )
})

ChatInput.displayName = "ChatInput"

export default ChatInput
