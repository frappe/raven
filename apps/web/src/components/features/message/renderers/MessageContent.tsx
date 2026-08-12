import { useMemo } from "react"
import { useAtomValue } from "jotai"
import { selectAtom } from "jotai/utils"
import { ForwardIcon, LucideIcon, PinIcon } from "lucide-react"
import { Message } from "@raven/types/common/Message"
import { editingMessageAtom } from "@utils/channelAtoms"
import ReplyMessage from "./ReplyMessage"
import { EditMessageComposer } from "./EditMessageComposer"
import { MessageImages } from "./MessageImages"
import { MessageFiles } from "./MessageFiles"
import { MessageVideo } from "./MessageVideo"
import { MessageAudio } from "./MessageAudio"
import RichTextRenderer, { isJumbomojiHtml } from "./RichTextRenderer"
import { MessageLinkPreview } from "./LinkPreview"
import { PollMessageContent } from "./PollMessageContent"
import SearchTextRenderer from "./SearchTextRenderer"
import { MessageReactionsRow } from "./MessageReactions"
import { getAttachmentKind } from "@utils/attachmentPreview"
import _ from "@lib/translate"
import { Badge } from "@components/ui/badge"

/**
 * Dispatch a message body string to the right renderer:
 *  - `message.text` is Tiptap HTML (begins with a block tag) → RichTextRenderer
 *  - sqlite FTS search snippets are plain text, optionally with `<mark>`
 *    highlights (which would begin with `<mark`) → SearchTextRenderer
 */
export const MessageBody = ({ content }: { content?: string | null }) => {
    if (!content) return null
    const trimmed = content.trim()
    if (!trimmed) return null
    // jumbomoji: emoji-only messages render big in the stream (not in compact
    // contexts like notifications, which use RichTextRenderer directly).
    if (trimmed.startsWith('<') && !trimmed.startsWith('<mark')) return <RichTextRenderer html={trimmed} jumbomoji />
    return <SearchTextRenderer content={trimmed} />
}

/**
 * A message's text body that swaps to the inline editor while this message is the
 * channel's edit target (`editingMessageAtom`). Used for a standalone text/caption
 * message and for a batch's caption-bearing member, so editing works the same way
 * everywhere the body is shown.
 */
export const EditableMessageBody = ({ message }: { message: Message }) => {
    // Subscribe to a derived boolean (is THIS message being edited?) rather than the
    // raw id, so toggling an edit only re-renders the affected body — not every body
    // sharing the channel's editing atom.
    const isEditing = useAtomValue(
        useMemo(
            () => selectAtom(editingMessageAtom(message.channel_id), (id) => id === message.name),
            [message.channel_id, message.name],
        ),
    )
    if (isEditing) return <EditMessageComposer message={message} />
    if (message.is_edited === 1 && message.text?.trim()) return <EditedMessageBody text={message.text} />
    return <MessageBody content={message.text} />
}

/** Escape the translated label before it goes into the message HTML. */
const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * The body with a small "(edited)" marker, Slack style. A message ending in a
 * paragraph gets the marker injected INSIDE that paragraph (as a data-edited
 * span the renderer styles), so it flows on the last line of wrapped text. A
 * message ending in anything else — a list, code block, table — gets the
 * marker on its own small line below; injected into those structures it
 * rendered inside them. A jumbomoji paragraph also takes the separate line:
 * added text would fail the emoji-only check and shrink the emojis.
 */
const EditedMessageBody = ({ text }: { text: string }) => {
    const label = `(${_("edited")})`
    const injected = useMemo(() => {
        const trimmed = text.trim()
        if (!trimmed.endsWith("</p>") || isJumbomojiHtml(trimmed)) return null
        return `${trimmed.slice(0, -"</p>".length)}<span data-edited>${escapeHtml(label)}</span></p>`
    }, [text, label])

    if (injected) return <MessageBody content={injected} />
    return (
        <>
            <MessageBody content={text} />
            <div className="text-sm text-ink-gray-5">{label}</div>
        </>
    )
}

/** Pinned / Forwarded badges. Takes just the flags so a BATCH can pass an
 *  aggregate of its members (each badge shown once for the whole block).
 *  Edited is NOT a badge — it renders as a small inline "(edited)" at the end
 *  of the text body (see EditedMessageBody). */
export const MessageAttributes = ({ message }: { message: Pick<Message, "is_pinned" | "is_forwarded"> }) => {
    if (!message.is_pinned && !message.is_forwarded) return null
    return (
        <div className="flex items-center gap-1.5 py-0.5">
            {message.is_pinned === 1 && <MessageAttributeIndicator attribute={_("Pinned")} Icon={PinIcon} theme="violet" />}
            {message.is_forwarded === 1 && <MessageAttributeIndicator attribute={_("Forwarded")} Icon={ForwardIcon} />}
        </div>
    )
}

const MessageAttributeIndicator = ({ attribute, Icon, theme = "gray" }: { attribute: string, Icon: LucideIcon, theme?: "gray" | "violet" }) => (
    <Badge theme={theme}>
        <Icon />
        {attribute}
    </Badge>
    // <div className="text-ink-gray-6 flex items-center gap-1.5 py-0.5">
    //     <Icon className="size-3" />
    //     <span className="text-xs">{attribute}</span>
    // </div>
)

/** Dispatch a single file-bearing message to the right inline renderer by kind. */
const MessageMedia = ({ message, fileUrl }: { message: Message; fileUrl: string }) => {
    switch (getAttachmentKind(fileUrl)) {
        case "image":
            return <MessageImages messages={[message]} />
        case "video":
            return <MessageVideo messages={[message]} />
        case "audio":
            return <MessageAudio messages={[message]} />
        default:
            // pdf + everything non-previewable → file pill (opens the viewer)
            return <MessageFiles messages={[message]} />
    }
}

export const MessageContent = ({ message, showLinkPreview = true }: { message: Message, showLinkPreview?: boolean }) => {
    const messageFile = "file" in message ? (message.file as string | undefined) : undefined

    const repliedMessageDetails = useMemo(() => {
        if (message.replied_message_details) {
            try {
                return JSON.parse(message.replied_message_details)
            } catch {
                return null
            }
        }
        return null
    }, [message.replied_message_details])

    // min-w-0: without it this flex column can't shrink below its content, so
    // fixed-width media overflows narrow (mobile) columns and gets clipped
    return (
        <div className="flex-1 min-w-0 space-y-1">
            <MessageAttributes message={message} />

            {message.linked_message && repliedMessageDetails && (
                <ReplyMessage
                    repliedMessage={repliedMessageDetails}
                    channelID={message.channel_id}
                    linkedMessageID={message.linked_message}
                />
            )}

            {/* Media dispatch is by file EXTENSION, not message_type (a video
                arrives as message_type "File" but should render as a player) */}
            {message.message_type === "Poll" ? (
                <PollMessageContent message={message} />
            ) : messageFile ? (
                <>
                    <MessageMedia message={message} fileUrl={messageFile} />
                    {/* Caption (editable inline). Hidden when empty unless being edited. */}
                    {(message.text || undefined) && <EditableMessageBody message={message} />}
                </>
            ) : (
                // Render the HTML body (message.text), NOT message.content — the
                // latter is the backend's derived plain-text (search/teasers).
                <EditableMessageBody message={message} />
            )}

            {/* Preview for the first link in the body (YouTube embed for now) */}
            {showLinkPreview && <MessageLinkPreview message={message} />}

            <MessageReactionsRow message={message} />
        </div>
    )
}

export default MessageContent
