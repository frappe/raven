import { Message } from '../../../../../../types/Messaging/Message'
import { DeleteMessageDialog, useDeleteMessage } from '../ChatMessage/MessageActions/DeleteMessage'
import { EditMessageDialog, useEditMessage } from '../ChatMessage/MessageActions/EditMessage'
import { MessageItem } from '../ChatMessage/MessageItem'
import { ChannelHistoryFirstMessage } from '@/components/layout/EmptyState/EmptyState'
import useChatStream from './useChatStream'
import { forwardRef, MutableRefObject, useEffect, useImperativeHandle } from 'react'
import { Loader } from '@/components/common/Loader'
import ChatStreamLoader from './ChatStreamLoader'
import clsx from 'clsx'
import { DateSeparator } from '@/components/layout/Divider/DateSeparator'
import { useInView } from 'react-intersection-observer'
import { Button } from '@radix-ui/themes'
import { FiArrowDown } from 'react-icons/fi'
import { ErrorBanner } from '@/components/layout/AlertBanner/ErrorBanner'
import { ForwardMessageDialog, useForwardMessage } from '../ChatMessage/MessageActions/ForwardMessage'
import AttachFileToDocumentDialog, { useAttachFileToDocument } from '../ChatMessage/MessageActions/AttachFileToDocument'
import { ReactionAnalyticsDialog, useMessageReactionAnalytics } from '../ChatMessage/MessageActions/MessageReactionAnalytics'
import SystemMessageBlock from '../ChatMessage/SystemMessageBlock'
import { useUserData } from '@/hooks/useUserData'

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

type Props = {
    channelID: string,
    replyToMessage: (message: Message) => void,
    showThreadButton?: boolean,
    scrollRef: MutableRefObject<HTMLDivElement | null>,
    pinnedMessagesString?: string,
    onModalClose?: () => void,
    isChannelReadOnly?: boolean,
}

const ChatStream = forwardRef(({ channelID, replyToMessage, showThreadButton = true, pinnedMessagesString, scrollRef, onModalClose, isChannelReadOnly = false }: Props, ref) => {

    const { messages, hasOlderMessages, loadOlderMessages, goToLatestMessages, hasNewMessages, error, loadNewerMessages, isLoading, highlightedMessage, scrollToMessage } = useChatStream(channelID, scrollRef, pinnedMessagesString)
    const { setDeleteMessage, ...deleteProps } = useDeleteMessage(onModalClose)

    const { setEditMessage, ...editProps } = useEditMessage(onModalClose)
    const { setForwardMessage, ...forwardProps } = useForwardMessage(onModalClose)
    const { setAttachDocument, ...attachDocProps } = useAttachFileToDocument(onModalClose)

    const { setReactionMessage, ...reactionProps } = useMessageReactionAnalytics(onModalClose)

    const onReplyMessageClick = (messageID: string) => {
        scrollToMessage(messageID)
    }

    const { name: userID } = useUserData()

    // When the user presses the up arrow, we need to check if the last message is a message sent by the user and is a text message (not system or file)
    // If so, we need to open the edit modal for that message
    // This function needs to be called from the parent component
    useImperativeHandle(ref, () => ({
        onUpArrow: () => {
            if (messages && messages.length > 0) {
                const lastMessage = messages[messages.length - 1]
                if (lastMessage.message_type === 'Text' && lastMessage.owner === userID && !lastMessage.is_bot_message) {
                    setEditMessage(lastMessage)
                }
            }
        }
    }))

    const { ref: oldLoaderRef } = useInView({
        fallbackInView: true,
        initialInView: false,
        skip: !hasOlderMessages,
        onChange: (async (inView) => {
            if (inView && hasOlderMessages) {
                await loadOlderMessages()
            }
        })
    });

    const { ref: newLoaderRef } = useInView({
        fallbackInView: true,
        skip: !hasNewMessages,
        initialInView: false,
        onChange: (inView) => {
            if (inView && hasNewMessages) {
                loadNewerMessages()
            }
        }
    });

    // Add a resize observer so that if the user is near the bottom of the chat, we can scroll to the bottom when the user resizes the window + any link previews are loaded
    useEffect(() => {
        if (!scrollRef.current) return

        const observer = new ResizeObserver(() => {
            const scrollContainer = scrollRef.current
            if (!scrollContainer) return

            // Check if we're near bottom before adjusting scroll
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 100) {
                requestAnimationFrame(() => {
                    scrollContainer.scrollTo({
                        top: scrollContainer.scrollHeight,
                        behavior: 'instant'
                    })
                })
            }
        })

        observer.observe(scrollRef.current)

        return () => {
            observer.disconnect()
        }
    }, []) // Only run once on mount since we're just observing the container

    return (
        <div className='relative h-full flex flex-col overflow-y-auto pb-16 sm:pb-0' ref={scrollRef}>
            <div ref={oldLoaderRef}>
                {hasOlderMessages && !isLoading && <div className='flex w-full min-h-8 pb-4 justify-center items-center'>
                    <Loader />
                </div>}
            </div>
            {!isLoading && !hasOlderMessages && <ChannelHistoryFirstMessage channelID={channelID ?? ''} />}
            {isLoading && <ChatStreamLoader />}
            {error && <ErrorBanner error={error} />}
            <div className={clsx('flex flex-col pb-4 z-50 transition-opacity duration-400 ease-ease-out-cubic', isLoading ? 'opacity-0' : 'opacity-100')}>
                {messages?.map(message => {
                    if (message.message_type === 'date') {
                        return <DateSeparator key={`date-${message.creation}`} id={`date-${message.creation}`} className='p-2 z-10 relative'>
                            {message.creation}
                        </DateSeparator>
                    } else if (message.message_type === 'System') {
                        return <SystemMessageBlock key={`${message.name}_${message.modified}`} message={message} />
                    } else {
                        return <div key={`${message.name}_${message.modified}`} id={`message-${message.name}`}>
                            <div className="w-full overflow-x-clip overflow-y-visible text-ellipsis">
                                <MessageItem
                                    message={message}
                                    isHighlighted={highlightedMessage === message.name}
                                    onReplyMessageClick={onReplyMessageClick}
                                    setEditMessage={setEditMessage}
                                    replyToMessage={replyToMessage}
                                    forwardMessage={setForwardMessage}
                                    showThreadButton={showThreadButton}
                                    onAttachDocument={setAttachDocument}
                                    setDeleteMessage={setDeleteMessage}
                                    setReactionMessage={setReactionMessage}
                                    isChannelReadOnly={isChannelReadOnly}
                                />
                            </div>
                        </div>
                    }
                }
                )}
            </div>
            {hasNewMessages && <div ref={newLoaderRef}>
                <div className='flex w-full min-h-8 pb-4 justify-center items-center'>
                    <Loader />
                </div>
            </div>}

            {hasNewMessages && <div className='fixed bottom-36 z-50 right-5'>
                <Button
                    className='shadow-lg'
                    onClick={goToLatestMessages}>
                    Scroll to new messages
                    <FiArrowDown size={18} />
                </Button>
            </div>}
            <DeleteMessageDialog {...deleteProps} />
            <EditMessageDialog {...editProps} />
            <ForwardMessageDialog {...forwardProps} />
            <AttachFileToDocumentDialog {...attachDocProps} />
            <ReactionAnalyticsDialog {...reactionProps} />
        </div>

    )
})

export default ChatStream