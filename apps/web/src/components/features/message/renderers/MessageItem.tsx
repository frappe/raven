import { Message } from "@raven/types/common/Message"
import { MessageThreadPill, ThreadConnector } from "./ThreadMessage"
import { useIntersectionObserver } from "usehooks-ts"
import { MessageContent } from "./MessageContent"
import { MessageReactionsRow } from "./MessageReactions"
import { MessageRow, MessageSenderLayout } from "./MessageRow"
import { FailedSendIndicator, OptimisticStatus, optimisticRowClass, sendingDimClass } from "./OptimisticStatus"
import { isThreadParent } from "@utils/messageUtils"
import { useMessageAlignment } from "@hooks/useChatStyle"

/**
 * Anatomy of a message
 *
 * A message "stream" is a list of messages separated by dates
 *
 * A date block is a simple divider with a date. Any message below the divider was sent on this date.
 * Two date blocks can never be adjacent to each other.
 *
 * A message block can be of multiple types depending on the message type + who sent it and when.
 *
 * If two messages are sent by the same person within 2 minutes of each other, they are grouped together.
 * The first message in such a group will have a User Avatar, Name and timestamp, and the rest will not.
 * Subsequent message blocks in this 'mini-block' will only show a timestamp on hover.
 *
 * The message block can be of the following types:
 * 1. Image - this will show a preview of the image. Clicking on it will open the image in a modal.
 * 2. File - this will show a small box with the file name with actions to copy the link or download the file.
 *      PDF - PDF files will also have an action to open the file in a modal.
 *      Video - A video file will have a preview of the video.
 * 3. Text - this will show the text message in a tiptap renderer. A text block can have multiple elements
 *     1. Text - this will show the text as is (p, h1, h2, h3, h4, h5, h6, blockquote, li, ul, ol)
 *     2. Code - this will show in a container with a quick action button to copy it
 *     3. Mention - this will show the mentioned user's name (highlighted) and hovering over them should show a card with their details
 *
 * A message can also be a reply to another message. In this case, the message will have a small box at the top with the message content and a click will jump to the message.
 *
 * Every message has reactions at the very bottom. Every reaction has a count and a list of users who reacted to it.
 *
 * Every message will have a context menu (right click) with the following options:
 * 1. Reply - this will open the reply box with the message quoted
 * 2. Edit - this will open the edit box with the message content
 * 3. Delete - this will delete the message
 * 4. Copy - this will copy the message content
 * 5. Copy Link - this will copy the message link (if file)
 * 6. Send in an email
 * 7. Link with document
 * 8. Bookmark
 *
 * Every message will have a hover menu with the following options:
 * 1. Reaction emojis with the frequently used emojis for that user on this channel
 * 2. Reply/Edit depending on the user
 * 3. Ellipsis to open the context menu
 *
 */

export const MessageItem = ({ message, onInView }: { message: Message; onInView?: (message: Message) => void }) => {

    const showThread = isThreadParent(message)

    const owner = message.is_bot_message ? message.bot || '' : message.owner
    // Own rows have no avatar column for the thread connector; their pill
    // renders as the bubble's footer instead.
    const { isLeftRight, isOwn } = useMessageAlignment(owner)

    const { ref } = useIntersectionObserver({
        onChange: (isIntersecting) => {
            if (onInView && isIntersecting) {
                onInView(message)
            }
        }
    })

    // Pure render: interactivity (context menu, action sheet, dialogs) lives at
    // the stream level via event delegation on the data-message-id wrapper.
    // A thread parent is never a continuation (the selector enforces this), so
    // the connector always anchors to the full header — no is_continuation branch.
    // Left-Right rows show a failed send as an icon beside the message
    // (iMessage-style) instead of the red row wash.
    return <MessageRow
        ref={ref}
        alignment={isOwn ? "own" : isLeftRight ? "left-right" : "simple"}
        className={isLeftRight ? sendingDimClass(message) : optimisticRowClass(message)}
    >
        {showThread && <ThreadConnector side={isOwn ? "right" : "left"} />}
        <MessageSenderLayout
            owner={owner}
            creation={message.creation}
            isContinuation={message.is_continuation === 1}
            isLeftRight={isLeftRight}
            isOwn={isOwn}
            reactions={isLeftRight ? <MessageReactionsRow message={message} /> : undefined}
            footer={showThread && isOwn ? <MessageThreadPill threadID={message.name} channelID={message.channel_id} align="end" /> : undefined}
            statusIcon={isOwn ? <FailedSendIndicator message={message} /> : undefined}
        >
            <MessageContent message={message} showReactions={!isLeftRight} bubble={isLeftRight ? (isOwn ? "end" : "start") : undefined} />
            <OptimisticStatus message={message} />
        </MessageSenderLayout>

        {showThread && !isOwn ? <MessageThreadPill threadID={message.name} channelID={message.channel_id} align="start" /> : null}
    </MessageRow>
}


