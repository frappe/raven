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
import RichTextRenderer, { isJumbomojiHtml, parseBodySegments } from "./RichTextRenderer"
import { messageBubbleClass } from "./MessageRow"
import { cn } from "@lib/utils"
import { MessageLinkPreview } from "./LinkPreview"
import { PollMessageContent } from "./PollMessageContent"
import SearchTextRenderer from "./SearchTextRenderer"
import { MessageReactionsRow } from "./MessageReactions"
import { DocumentLinkRenderer } from "./DocumentLinkRenderer"
import { getAttachmentKind } from "@utils/attachmentPreview"
import { escapeHtml } from "@utils/htmlUtils"
import { parseRepliedMessageDetails } from "@utils/messageUtils"
import { useCustomEmojiShortcodes } from "@lib/customEmojiShortcodes"
import type { RepliedMessageDetails } from "./RepliedMessagePreview"
import _ from "@lib/translate"
import { Badge } from "@components/ui/badge"

/**
 * Dispatch a message body string to the right renderer:
 *  - `message.text` is Tiptap HTML (begins with a block tag) → RichTextRenderer
 *  - sqlite FTS search snippets are plain text, optionally with `<mark>`
 *    highlights (which would begin with `<mark`) → SearchTextRenderer
 */
export const MessageBody = ({ content, bubble = false }: { content?: string | null; bubble?: boolean }) => {
    if (!content) return null
    const trimmed = content.trim()
    if (!trimmed) return null
    // jumbomoji: emoji-only messages render big in the stream (not in compact
    // contexts like notifications, which use RichTextRenderer directly).
    if (trimmed.startsWith('<') && !trimmed.startsWith('<mark')) {
        if (bubble) return <BubbledBody html={trimmed} />
        return <RichTextRenderer html={trimmed} jumbomoji />
    }
    if (bubble) return <div className={messageBubbleClass}><SearchTextRenderer content={trimmed} /></div>
    return <SearchTextRenderer content={trimmed} />
}

/**
 * The Left-Right text body: iMessage style. Text runs get a bubble each,
 * code blocks and lone GIFs render bare between them, and an emoji-only
 * message renders big with no bubble at all. The parent column (see
 * MessageContent's bubble mode) aligns the pieces left or right.
 */
const BubbledBody = ({ html }: { html: string }) => {
    const shortcodes = useCustomEmojiShortcodes(html)
    const segments = useMemo(() => parseBodySegments(html, shortcodes), [html, shortcodes])
    return (
        <>
            {segments.map((segment, index) => (
                <div
                    key={index}
                    className={cn(
                        "tiptap max-w-full min-w-0",
                        segment.jumbo && "tiptap--jumbomoji",
                        !segment.standalone && messageBubbleClass,
                    )}
                >
                    {segment.node}
                </div>
            ))}
        </>
    )
}

/**
 * A message's text body that swaps to the inline editor while this message is the
 * channel's edit target (`editingMessageAtom`). Used for a standalone text/caption
 * message and for a batch's caption-bearing member, so editing works the same way
 * everywhere the body is shown.
 */
export const EditableMessageBody = ({ message, bubble = false }: { message: Message; bubble?: boolean }) => {
    // Subscribe to a derived boolean (is THIS message being edited?) rather than the
    // raw id, so toggling an edit only re-renders the affected body — not every body
    // sharing the channel's editing atom.
    const isEditing = useAtomValue(
        useMemo(
            () => selectAtom(editingMessageAtom(message.channel_id), (id) => id === message.name),
            [message.channel_id, message.name],
        ),
    )
    // The editor is never bubbled — it takes the full width while editing.
    if (isEditing) return <EditMessageComposer message={message} />
    if (message.is_edited === 1 && message.text?.trim()) return <EditedMessageBody text={message.text} bubble={bubble} />
    return <MessageBody content={message.text} bubble={bubble} />
}

/**
 * The body with a small "(edited)" marker, Slack style. A message ending in a
 * paragraph gets the marker injected INSIDE that paragraph (as a data-edited
 * span the renderer styles), so it flows on the last line of wrapped text. A
 * message ending in anything else — a list, code block, table — gets the
 * marker on its own small line below; injected into those structures it
 * rendered inside them. A jumbomoji paragraph also takes the separate line:
 * added text would fail the emoji-only check and shrink the emojis.
 */
const EditedMessageBody = ({ text, bubble = false }: { text: string; bubble?: boolean }) => {
    const label = `(${_("edited")})`
    const shortcodes = useCustomEmojiShortcodes(text)
    const injected = useMemo(() => {
        const trimmed = text.trim()
        if (!trimmed.endsWith("</p>") || isJumbomojiHtml(trimmed, shortcodes)) return null
        return `${trimmed.slice(0, -"</p>".length)}<span data-edited>${escapeHtml(label)}</span></p>`
    }, [text, label, shortcodes])

    if (injected) return <MessageBody content={injected} bubble={bubble} />
    return (
        <>
            <MessageBody content={text} bubble={bubble} />
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

/** `showLinkedDocument` off for compact surfaces (thread lists, result blocks)
 *  that render their own inline doc link or want no card. `showReactions` off
 *  when the caller renders the reactions row outside the content (Left-Right).
 *
 *  `bubble` turns on the iMessage layout: only TEXT gets a bubble; media,
 *  polls, cards, code blocks and GIFs render bare, stacked in a column that
 *  aligns "start" (others) or "end" (own messages). */
export const MessageContent = ({ message, showLinkPreview = true, showLinkedDocument = true, showReactions = true, bubble }: { message: Message, showLinkPreview?: boolean, showLinkedDocument?: boolean, showReactions?: boolean, bubble?: "start" | "end" }) => {
    const messageFile = "file" in message ? (message.file as string | undefined) : undefined

    // String from fetches, OBJECT from realtime/ack payloads — the shared
    // parser accepts both (a bare JSON.parse dropped live receivers' quotes).
    const repliedMessageDetails = useMemo(
        () => parseRepliedMessageDetails<RepliedMessageDetails>(message.replied_message_details),
        [message.replied_message_details],
    )

    // min-w-0: without it this flex column can't shrink below its content, so
    // fixed-width media overflows narrow (mobile) columns and gets clipped.
    // Bubble mode is a flex column so each piece (bubble, card, media) keeps
    // its own width and the column aligns them to the message's side. The
    // editor escape lets the inline edit box take the full width back.
    return (
        <div
            className={cn(
                "flex-1 min-w-0",
                bubble
                    ? cn(
                        "flex max-w-full flex-col gap-1 has-[[data-raven-editor]]:w-full",
                        bubble === "end" ? "items-end" : "items-start",
                    )
                    : "space-y-1",
            )}
        >
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
                    {(message.text || undefined) && <EditableMessageBody message={message} bubble={!!bubble} />}
                </>
            ) : (
                // Render the HTML body (message.text), NOT message.content — the
                // latter is the backend's derived plain-text (search/teasers).
                <EditableMessageBody message={message} bubble={!!bubble} />
            )}

            {/* Preview for the first link in the body (YouTube embed for now) */}
            {showLinkPreview && <MessageLinkPreview message={message} />}

            {/* Linked document card sits ABOVE the reactions — reactions are always last.
                In bubble mode the column is fit-content, so the card asks for a fixed
                width (capped to the column on narrow screens) instead of stretching. */}
            {showLinkedDocument && message.link_doctype && message.link_document && (
                <DocumentLinkRenderer
                    doctype={message.link_doctype}
                    docname={message.link_document}
                    className={bubble ? "w-96 max-w-full" : undefined}
                />
            )}

            {showReactions && <MessageReactionsRow message={message} />}
        </div>
    )
}

export default MessageContent
