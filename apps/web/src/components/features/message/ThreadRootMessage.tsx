import { useCallback, useState, useSyncExternalStore } from "react"
import { useFrappeGetDoc } from "frappe-react-sdk"
import { ChevronDown, ChevronUp, Paperclip } from "lucide-react"
import { Button } from "@components/ui/button"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { MessageContent } from "@components/features/message/renderers/MessageContent"
import { useUser } from "@hooks/useUser"
import { channelMessagesStore } from "@stores/messages/store"
import type { Message } from "@raven/types/common/Message"
import { getDateObject } from "@lib/date"
import _ from "@lib/translate"
import { useAtomValue } from "jotai"
import { timeFormatAtom } from "@utils/preferences"

/**
 * The thread's root (parent) message. A thread's id IS that message's id, so when the thread
 * was opened from its channel the message is already in that channel's loaded window — read it
 * from the store and skip the fetch (v2 always refetched). Falls back to a single-doc fetch for
 * deep links / when the parent has scrolled out of the window.
 */
const useThreadRootMessage = (threadID: string, parentID?: string): Message | undefined => {
    // No parent (e.g. a cold threads-page deep-link) → the store read just misses ("" has no
    // window) and we fall through to the single-doc fetch, which resolves the root by threadID.
    const lookupID = parentID ?? ""
    const fromStore = useSyncExternalStore(
        useCallback((cb) => channelMessagesStore.subscribe(lookupID, cb), [lookupID]),
        () => channelMessagesStore.getState(lookupID).byId.get(threadID),
    )
    // Null swrKey disables the fetch when the store already has the message.
    const { data } = useFrappeGetDoc<Message>(
        "Raven Message",
        fromStore ? "" : threadID,
        fromStore ? null : `raven_message:${threadID}`,
    )
    return fromStore ?? data
}

/** The file URL on file/image messages (the Message union only has `file` on those variants). */
const messageFile = (message: Message): string | undefined =>
    "file" in message ? (message.file as string | undefined) : undefined

/** One-line text/file summary of the root message for the collapsed preview. */
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
    const message = useThreadRootMessage(threadID, parentID)
    const [expanded, setExpanded] = useState(false)
    const author = useUser(message && message.is_bot_message ? (message.bot ?? message.owner) : message?.owner)

    if (!message) return null

    const authorName = author?.full_name || author?.name || _("User")

    return (
        <div className="shrink-0 border-b border-outline-gray-1 px-4 py-2">
            <div className="flex items-start gap-2.5">
                {author ? (
                    <UserAvatar user={author} size="md" showStatusIndicator={false} />
                ) : (
                    <div className="size-7 rounded-md bg-surface-gray-2" />
                )}
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
                            size="xs"
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
                            <MessageContent message={message} />
                        ) : (
                            <p className="flex items-center gap-1 truncate text-p-base text-ink-gray-7">
                                {messageFile(message) && <Paperclip className="size-3.5 shrink-0 text-ink-gray-5" />}
                                <span className="truncate">{rootPreviewText(message)}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
