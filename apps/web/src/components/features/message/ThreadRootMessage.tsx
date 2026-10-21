import { useCallback, useMemo, useState, useSyncExternalStore } from "react"
import { ChevronDown, ChevronUp, Paperclip } from "lucide-react"
import { Button } from "@components/ui/button"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { EditableMessageBody, MessageContent } from "@components/features/message/renderers/MessageContent"
import { BatchMediaGroups } from "@components/features/message/renderers/BatchMessageItem"
import { DocumentLinkInline, DocumentLinkRenderer } from "@components/features/message/renderers/DocumentLinkRenderer"
import RichTextRenderer from "@components/features/message/renderers/RichTextRenderer"
import { useUser } from "@hooks/useUser"
import { useMessageBatch } from "@hooks/useMessageBatch"
import { channelMessagesStore } from "@stores/messages/store"
import type { Message } from "@raven/types/common/Message"
import { getDateObject } from "@lib/date"
import { attachmentCountLabel } from "@utils/messageUtils"
import _ from "@lib/translate"
import { useAtomValue } from "jotai"
import { timeFormatAtom } from "@utils/preferences"

/**
 * The thread's root (parent) message and its send batch, resolved with at
 * most ONE request.
 *
 * A thread's id IS its root message's id. When the thread was opened from its
 * channel, the root is already in that channel's loaded window — read it from
 * the store, and if it's unbatched that's the whole answer, zero fetches.
 *
 * One get_message_batch call covers every other case: a store root that IS
 * part of a batch (we need the other members), and a cold deep link (we need
 * the root itself — the endpoint returns a list of one for unbatched
 * messages). The key is shared with ThreadDrawerRoute / NotificationChat, so
 * their parent-channel resolution and this header dedupe into one request.
 */
const useThreadRoot = (threadID: string, parentID?: string) => {
    // No parent (e.g. a cold threads-page deep-link) → the store read just
    // misses ("" has no window) and the batch fetch resolves the root.
    const lookupID = parentID ?? ""
    const fromStore = useSyncExternalStore(
        useCallback((cb) => channelMessagesStore.subscribe(lookupID, cb), [lookupID]),
        () => channelMessagesStore.getState(lookupID).byId.get(threadID),
    )
    const needsFetch = !fromStore || Boolean(fromStore.message_batch_id)
    const { messages } = useMessageBatch(needsFetch ? threadID : null)

    // Until (and unless) the batch call resolves, the store root stands alone.
    const members: Message[] = messages ?? (fromStore ? [fromStore] : [])
    const root = members.find((member) => member.name === threadID) ?? members[0]
    return { root, members }
}

/** The file URL on file/image messages (the Message union only has `file` on those variants). */
const messageFile = (message: Message): string | undefined =>
    "file" in message ? (message.file as string | undefined) : undefined

/** Text/file summary for roots with no HTML body (files, polls). */
const rootPreviewText = (message: Message): string => {
    const text = (message.content ?? "").trim()
    if (text) return text.split("\n")[0] // first line (e.g. a poll's question)
    const file = messageFile(message)
    if (file) return file.split("/").pop() ?? _("Attachment")
    return _("Message")
}

/**
 * The thread's root (parent) message, shown above the replies so you know what you're replying
 * to. Collapsed to a one-line preview by default (keeps the panel compact) with an expand
 * toggle that reveals the full message via the shared renderer. Renders nothing until the
 * message resolves. (Key it by threadID at the call site so the expand state resets per thread.)
 */
export const ThreadRootMessage = ({ threadID, parentID }: { threadID: string; parentID?: string }) => {

    const timeFormat = useAtomValue(timeFormatAtom)
    const { root: message, members } = useThreadRoot(threadID, parentID)
    const [expanded, setExpanded] = useState(false)
    const author = useUser(message && message.is_bot_message ? (message.bot ?? message.owner) : message?.owner)

    const isBatch = members.length > 1
    // The batch's one caption: whichever member has text (same rule as
    // BatchMessageItem). For a single root this is just the root itself.
    const captionMember = members.find((member) => member.text)
    const fileCount = members.filter((member) => messageFile(member)).length
    // A linked document rides one member (same rule as BatchMessageItem).
    // Covers the single-root case too: members is then a list of one.
    const linkedDocMember = members.find((member) => member.link_doctype && member.link_document)

    const previewHtml = useMemo(() => (captionMember?.text ?? "").trim(), [captionMember?.text])

    if (!message) return null

    const authorName = author?.full_name || author?.name || _("User")

    return (
        <div className="shrink-0 border-b border-outline-gray-1 px-4 py-2">
            <div className="flex items-start gap-2.5">
                <div className="pt-1">
                    {author ? (
                        <UserAvatar user={author} size="md" showStatusIndicator={false} />
                    ) : (
                        <div className="size-7 rounded-md bg-surface-gray-2" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Chevron lives on the header line (not beside the body), so it never
                        overlaps the expanded content regardless of how tall it grows. */}
                    <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-gray-9">{authorName}</span>
                        <span className="shrink-0 text-xs text-ink-gray-5">
                            {getDateObject(message.creation).format(timeFormat === "12-hour" ? "MMM D, h:mma" : "MMM D, HH:mm")}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            isIconButton
                            className="shrink-0"
                            onClick={() => setExpanded((v) => !v)}
                            aria-label={expanded ? _("Collapse message") : _("Expand message")}
                        >
                            {expanded ? <ChevronUp /> : <ChevronDown />}
                        </Button>
                    </div>
                    <div className="pt-0.5">
                        {expanded ? (
                            isBatch ? (
                                // The whole batch: media grouped like the stream's batch
                                // row, then the one caption. EditableMessageBody (text
                                // only) — the caption member's own file is already in
                                // the media groups above.
                                <div className="space-y-2">
                                    <BatchMediaGroups messages={members} />
                                    {captionMember && <EditableMessageBody message={captionMember} />}
                                    {linkedDocMember && (
                                        <DocumentLinkRenderer
                                            doctype={linkedDocMember.link_doctype!}
                                            docname={linkedDocMember.link_document!}
                                        />
                                    )}
                                </div>
                            ) : (
                                // MessageContent renders the linked-document card itself.
                                <MessageContent message={message} />
                            )
                        ) : (
                            // The whole collapsed preview is a click target for
                            // expanding — the chevron alone was too small a target.
                            // Clicks on links/mentions inside are theirs (same rule
                            // as notification rows); a div with button semantics,
                            // not a <button>, because the preview CONTAINS anchors
                            // and nested interactive elements are invalid in one.
                            <div
                                role="button"
                                tabIndex={0}
                                aria-label={_("Expand message")}
                                className="cursor-pointer"
                                onClick={(event) => {
                                    if ((event.target as HTMLElement).closest("a, button")) return
                                    setExpanded(true)
                                }}
                                onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault()
                                        setExpanded(true)
                                    }
                                }}
                            >
                                {/* Collapsed: the doctype + id line is enough — the full
                                    card (and its fetches) waits for expand. */}
                                {linkedDocMember && (
                                    <DocumentLinkInline
                                        doctype={linkedDocMember.link_doctype!}
                                        docname={linkedDocMember.link_document!}
                                        className="pb-1"
                                    />
                                )}
                                {previewHtml ? (
                                    // Collapsed but RICH: the real HTML body, height-capped.
                                    // Links and mentions stay clickable without expanding — a
                                    // plain-text teaser here was the top complaint. No
                                    // jumbomoji (this is a compact context, like
                                    // notifications). A max-height, NOT line-clamp: clamp
                                    // counts line boxes, so a code block (one giant line box)
                                    // blew straight through it, and blank lines counted too.
                                    // The cap can land mid-line — scroll-fade makes that read
                                    // as designed: an overflow-hidden box is still a scroll
                                    // container to CSS scroll-timelines, so the bottom fade
                                    // appears ONLY when content actually overflows. Short
                                    // roots get no fade at all.
                                    <>

                                        {/* The text alone would hide that files were sent
                                            with it — a muted count says what expanding
                                            reveals. */}
                                        {fileCount > 0 && (
                                            <p className="flex items-center gap-1 pb-1 text-sm text-ink-gray-5">
                                                <Paperclip className="size-3.5 shrink-0" />
                                                <span className="truncate">{attachmentCountLabel(fileCount)}</span>
                                            </p>
                                        )}
                                        <div className="max-h-[2lh] overflow-hidden scroll-fade md:text-p-base text-p-lg text-ink-gray-7">
                                            <RichTextRenderer html={previewHtml} />
                                        </div>
                                    </>
                                ) : isBatch || messageFile(message) || !linkedDocMember ? (
                                    // No caption → the plain one-line teaser: an attachment
                                    // count for a batch, the file name / poll question for a
                                    // single root. A document-only root skips it — the
                                    // doctype + id line above already says everything.
                                    <p className="flex items-center gap-1 truncate md:text-p-base text-p-lg text-ink-gray-7">
                                        {(isBatch || messageFile(message)) && (
                                            <Paperclip className="size-3.5 shrink-0 text-ink-gray-5" />
                                        )}
                                        <span className="truncate">
                                            {isBatch ? attachmentCountLabel(fileCount) : rootPreviewText(message)}
                                        </span>
                                    </p>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
