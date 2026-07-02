import { useMemo } from "react"
import { useIntersectionObserver } from "usehooks-ts"
import { MessageImages } from "./MessageImages"
import { MessageFiles } from "./MessageFiles"
import { MessageVideo } from "./MessageVideo"
import { MessageAudio } from "./MessageAudio"
import { EditableMessageBody } from "./MessageContent"
import { MessageReactionsRow } from "./MessageReactions"
import { MessageRow, MessageSenderLayout } from "./MessageRow"
import { MessageThreadPill } from "./ThreadMessage"
import ReplyMessage from "./ReplyMessage"
import { OptimisticStatus, optimisticRowClass } from "./OptimisticStatus"
import { getAttachmentKind, messagesToAttachments } from "@utils/attachmentPreview"
import { isThreadParent } from "@utils/messageUtils"
import type { MessageBatchBlock } from "@stores/messages/types"
import type { Message } from "@raven/types/common/Message"

type FileLikeMessage = Message & { file?: string }

const kindOf = (message: Message) => {
    const url = (message as FileLikeMessage).file
    return url ? getAttachmentKind(url) : "file"
}

/**
 * Renders a batch of messages sent together (shared message_batch_id) as one
 * visual block, grouped by media kind: images → album, videos/audio →
 * stacked players, docs → side-by-side pill grid, with one shared caption.
 *
 * Each member keeps its own `data-message-id` (on its tile/pill/player), so
 * action delegation and scroll-to-message still target individual messages.
 */
export const BatchMessageItem = ({
    block,
    onInView,
}: {
    block: MessageBatchBlock
    onInView?: (message: Message) => void
}) => {
    const head = block.messages[0]
    const newest = block.messages[block.messages.length - 1]

    // The selector keeps at most one thread parent in a batch (it splits 2+ into individual
    // messages), so find that member wherever it sits and show its pill + connector. v3 batch
    // actions create the thread on the NEWEST member (see blockFromEvent), but finding it by
    // is_thread (not by position) also covers threads created on any other member — e.g. by a
    // v2 client — instead of silently dropping the pill.
    const threadMember = block.messages.find(isThreadParent)

    const { ref } = useIntersectionObserver({
        onChange: (isIntersecting) => {
            // Read-tracking counts the batch as seen via its newest member
            if (onInView && isIntersecting) onInView(newest)
        },
    })

    // Partition by media kind (by extension): each group renders coherently —
    // album / video players / audio players / pill grid — instead of interleaved
    // one-off rows. pdf + non-previewable both go to the pill grid. Only file-
    // bearing messages are partitioned; the text caption (no file) is rendered
    // separately below and must not fall into the doc pill grid.
    const fileMessages = block.messages.filter((message) => (message as FileLikeMessage).file)
    const images = fileMessages.filter((message) => kindOf(message) === "image")
    const videos = fileMessages.filter((message) => kindOf(message) === "video")
    const audios = fileMessages.filter((message) => kindOf(message) === "audio")
    const docs = fileMessages.filter((message) => {
        const kind = kindOf(message)
        return kind === "pdf" || kind === "file"
    })

    // One combined set across the whole batch, shared by both renderers so a
    // mixed batch pages as ONE. Ordered images-first to match the layout.
    const attachments = useMemo(() => messagesToAttachments(block.messages), [block.messages])

    /** A batch carries one caption — whichever member has text (the composer sets it on one). */
    const captionMember = block.messages.find((message) => message.text)

    // A batch reply lives on one member (the send API attaches it to the last);
    // render the quote once, at the top of the block.
    const replyMember = block.messages.find((message) => message.linked_message && message.replied_message_details)
    const repliedDetails = useMemo(() => {
        if (!replyMember?.replied_message_details) return null
        try {
            return JSON.parse(replyMember.replied_message_details)
        } catch {
            return null
        }
    }, [replyMember?.replied_message_details])

    // Reactions target individual messages, so a batch can carry several rows —
    // one per member that has any (usually at most one)
    const memberReactions = block.messages.map((message) => (
        <MessageReactionsRow key={message.name} message={message} />
    ))

    const content = (
        <div className="space-y-2">
            {replyMember && repliedDetails && (
                <ReplyMessage
                    repliedMessage={repliedDetails}
                    channelID={replyMember.channel_id}
                    linkedMessageID={replyMember.linked_message}
                />
            )}
            {images.length > 0 && <MessageImages messages={images} attachments={attachments} />}
            {videos.length > 0 && <MessageVideo messages={videos} />}
            {audios.length > 0 && <MessageAudio messages={audios} />}
            {docs.length > 0 && <MessageFiles messages={docs} attachments={attachments} />}
            {captionMember && <EditableMessageBody message={captionMember} />}
            <OptimisticStatus message={head} />
            {memberReactions}
        </div>
    )

    return (
        <MessageRow ref={ref} className={optimisticRowClass(head)}>
            {threadMember && <div className="absolute left-7 w-6 border-l-2 border-b-2 border-outline-gray-2 rounded-bl-2xl z-0 top-[48px] h-[calc(100%-66px)]" />}
            <MessageSenderLayout
                owner={head.is_bot_message ? head.bot || '' : head.owner}
                creation={head.creation}
                isContinuation={block.is_continuation === 1}
            >
                {content}
            </MessageSenderLayout>

            {threadMember && <MessageThreadPill threadID={threadMember.name} />}
        </MessageRow>
    )
}
