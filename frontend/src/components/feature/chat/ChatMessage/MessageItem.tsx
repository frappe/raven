import { Avatar, Badge, Box, BoxProps, Button, ContextMenu, Flex, HoverCard, IconButton, Link, Text, Theme } from '@radix-ui/themes'
import { Message, MessageBlock } from '../../../../../../types/Messaging/Message'
import { MessageContextMenu } from './MessageActions/MessageActions'
import { DateTooltip, DateTooltipShort } from './Renderers/DateTooltip'
import { clsx } from 'clsx'
import { UserAvatar, getInitials } from '@/components/common/UserAvatar'
import { useGetUser } from '@/hooks/useGetUser'
import { useIsUserActive } from '@/hooks/useIsUserActive'
import { UserFields } from '@/utils/users/UserListProvider'
import { BsFillCircleFill } from 'react-icons/bs'
import { MessageReactions } from './MessageReactions'
import { ImageMessageBlock } from './Renderers/ImageMessage'
import { FileMessageBlock } from './Renderers/FileMessage'
import { PollMessageBlock } from './Renderers/PollMessage'
import { TiptapRenderer } from './Renderers/TiptapRenderer/TiptapRenderer'
import { QuickActions } from './MessageActions/QuickActions/QuickActions'
import { memo, useContext, useMemo, useState } from 'react'
import { ReplyMessageBox } from './ReplyMessageBox/ReplyMessageBox'
import { generateAvatarColor } from '../../selectDropdowns/GenerateAvatarColor'
import { DoctypeLinkRenderer } from './Renderers/DoctypeLinkRenderer'
import { useDebounce } from '@/hooks/useDebounce'
import { RiPushpinFill, RiRobot2Fill, RiShareForwardFill } from 'react-icons/ri'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useDoubleTap } from 'use-double-tap'
import useOutsideClick from '@/hooks/useOutsideClick'
import { getStatusText } from '../../userSettings/AvailabilityStatus/SetUserAvailabilityMenu'
import { ThreadMessage } from './Renderers/ThreadMessage'
import OnLeaveBadge from '@/components/common/UserLeaveBadge'
import { LeftRightLayout } from './LeftRightLayout/LeftRightLayout'
import { useParams } from 'react-router-dom'
import { FrappeConfig } from 'frappe-react-sdk'
import { FrappeContext } from 'frappe-react-sdk'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getErrorMessage } from '@/components/layout/AlertBanner/ErrorBanner'
import { Stack } from '@/components/layout/Stack'
import { BiChat } from 'react-icons/bi'

interface MessageBlockProps {
    message: Message,
    setDeleteMessage: (message: Message) => void,
    setEditMessage: (message: Message) => void,
    replyToMessage: (message: Message) => void,
    forwardMessage: (message: Message) => void,
    onReplyMessageClick: (messageID: string) => void,
    onAttachDocument: (message: Message) => void,
    isHighlighted?: boolean,
    setReactionMessage: (message: Message) => void,
    showThreadButton?: boolean,
    isChannelReadOnly?: boolean,
}

export const MessageItem = ({ message, setDeleteMessage, isHighlighted, onReplyMessageClick, setEditMessage, replyToMessage, forwardMessage, onAttachDocument, setReactionMessage, showThreadButton = true, isChannelReadOnly = false }: MessageBlockProps) => {

    const { name, owner: userID, is_bot_message, bot, creation: timestamp, message_reactions, is_continuation, linked_message, replied_message_details } = message

    const { user, isActive } = useGetUserDetails(is_bot_message && bot ? bot : userID)

    const onDelete = () => {
        setDeleteMessage(message)
    }

    const onEdit = () => {
        setEditMessage(message)
    }

    const onReply = () => {
        replyToMessage(message)
    }

    const onForward = () => {
        forwardMessage(message)
    }

    const onAttachToDocument = () => {
        onAttachDocument(message)
    }

    const onViewReaction = () => {
        setReactionMessage(message)
    }

    const isDesktop = useIsDesktop()

    const [isHovered, setIsHovered] = useState(false)
    const isHoveredDebounced = useDebounce(isHovered, isDesktop ? 400 : 200)

    const onMouseEnter = () => {
        if (isDesktop) {
            setIsHovered(true)
        }
    }

    const onMouseLeave = () => {
        if (isDesktop) {
            setIsHovered(false)
        }
    }

    // For mobile, we want to show the quick actions on double tap
    const bind = useDoubleTap((event) => {
        if (!isDesktop)
            setIsHovered(!isHovered)
    });

    const ref = useOutsideClick(() => {
        if (!isDesktop)
            setIsHovered(false)
    });

    const replyMessageDetails = useMemo(() => {
        if (typeof replied_message_details === 'string') {
            return JSON.parse(replied_message_details)
        } else {
            return replied_message_details
        }
    }, [replied_message_details])

    const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false)

    // @ts-ignore
    const CHAT_STYLE = window.frappe?.boot?.chat_style ?? 'Simple'

    const [selectedText, setSelectedText] = useState('')

    const onContextMenuChange = (open: boolean) => {
        if (open) {
            // Get the selection that te user is actually highlighting
            const selection = document.getSelection()
            if (selection) {
                setSelectedText(selection.toString().trim())
            }
        } else {
            setSelectedText('')
        }
    }

    return (
        <>
            {CHAT_STYLE === 'Left-Right' ? <LeftRightLayout
                message={message}
                user={user}
                isActive={isActive}
                isHighlighted={isHighlighted}
                onReplyMessageClick={onReplyMessageClick}
                onDelete={onDelete}
                showThreadButton={showThreadButton}
                onEdit={onEdit}
                onReply={onReply}
                onForward={onForward}
                onViewReaction={onViewReaction}
                onAttachToDocument={onAttachToDocument}
            /> :
                <Box className='relative'>
                    {!message.is_continuation && message.is_thread ?
                        <div
                            className={`absolute 
                        border-l
                        border-b
                        border-gray-5 
                        h-[calc(100%-66px)] 
                        rounded-bl-lg
                        w-6
                        top-[42px] 
                        left-6 z-0`}>
                        </div> : null}
                    <ContextMenu.Root modal={false} onOpenChange={onContextMenuChange}>
                        <ContextMenu.Trigger
                            {...bind}
                            ref={ref}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                            className={clsx(`group
                            sm:hover:bg-gray-2
                            active:bg-gray-2
                            sm:hover:transition-all
                            active:hover:transition-all
                            sm:hover:delay-100
                            active:hover:delay-100
                            select-none
                            sm:select-auto
                            sm:dark:hover:bg-gray-3
                            dark:active:bg-gray-4
                            data-[state=open]:bg-accent-2
                            dark:data-[state=open]:bg-gray-4
                            data-[state=open]:shadow-sm
                            transition-colors
                            px-1
                            py-1.5
                            sm:p-1.5
                            rounded-md`, is_continuation ? '' : 'pt-2.5 sm:pt-3', isHighlighted ? 'bg-yellow-50 hover:bg-yellow-50 dark:bg-yellow-300/20 dark:hover:bg-yellow-300/20' : !isDesktop && isHovered ? 'bg-gray-2 dark:bg-gray-3' : '', isEmojiPickerOpen ? 'bg-gray-2 dark:bg-gray-3' : '')}>
                            <Flex className='gap-2.5 sm:gap-3 items-start'>
                                <MessageLeftElement message={message} user={user} isActive={isActive} />
                                <Flex direction='column' className='gap-0.5 w-[90%]' justify='center'>
                                    {!is_continuation ? <Flex align='center' gap='2' mt='-1'>
                                        <UserHoverCard
                                            user={user}
                                            userID={userID}
                                            isActive={isActive} />
                                        <DateTooltip timestamp={timestamp} />
                                    </Flex>
                                        : null}
                                    {/* Message content goes here */}
                                    {message.is_forwarded === 1 && <Flex className='text-gray-10 text-xs' gap={'1'} align={'center'}><RiShareForwardFill size='12' /> forwarded</Flex>}
                                    {message.is_pinned === 1 && <Flex className='text-accent-9 text-xs' gap={'1'} align={'center'}><RiPushpinFill size='12' /> Pinned</Flex>}
                                    {/* If it's a reply, then show the linked message */}
                                    {linked_message && replied_message_details && <ReplyMessageBox
                                        className='sm:min-w-[28rem] cursor-pointer mb-1'
                                        role='button'
                                        onClick={() => onReplyMessageClick(linked_message)}
                                        message={replyMessageDetails} />
                                    }

                                    { /* Show message according to type */}

                                    <MessageContent
                                        message={message}
                                        user={user}
                                        isChannelReadOnly={isChannelReadOnly}
                                    />

                                    {message.link_doctype && message.link_document && <Box className={clsx(message.is_continuation ? 'ml-0.5' : '-ml-0.5')}>
                                        <DoctypeLinkRenderer doctype={message.link_doctype} docname={message.link_document} />
                                    </Box>}
                                    {message.is_edited === 1 && <Text size='1' className='text-gray-10'>(edited)</Text>}
                                    {message_reactions?.length &&
                                        <MessageReactions
                                            message={message}
                                            message_reactions={message_reactions}
                                        />
                                    }

                                    {message.is_thread === 1 ? <ThreadMessage thread={message} /> : null}
                                </Flex>
                                {(isHoveredDebounced || isEmojiPickerOpen) &&
                                    <QuickActions
                                        message={message}
                                        onDelete={onDelete}
                                        isEmojiPickerOpen={isEmojiPickerOpen}
                                        setIsEmojiPickerOpen={setEmojiPickerOpen}
                                        onEdit={onEdit}
                                        onReply={onReply}
                                        onForward={onForward}
                                        showThreadButton={showThreadButton}
                                        onAttachDocument={onAttachToDocument}
                                    />
                                }
                            </Flex>

                        </ContextMenu.Trigger>

                        <MessageContextMenu
                            message={message}
                            onDelete={onDelete}
                            showThreadButton={showThreadButton}
                            onEdit={onEdit}
                            onReply={onReply}
                            onForward={onForward}
                            onViewReaction={onViewReaction}
                            selectedText={selectedText}
                            onAttachDocument={onAttachToDocument}
                        />
                    </ContextMenu.Root>
                </Box>}
        </>
    )
}

type MessageLeftElementProps = BoxProps & {
    message: MessageBlock['data'],
    user?: UserFields,
    isActive?: boolean
}
const MessageLeftElement = ({ message, className, user, isActive, ...props }: MessageLeftElementProps) => {

    // If it's a continuation, then show the timestamp

    // Else, show the avatar
    return <Box className={clsx(message.is_continuation ? 'invisible group-hover:visible flex items-center w-[32px]' : '', className)} {...props}>
        {message.is_continuation ?
            <Box className='-mt-0.5'>
                <DateTooltipShort timestamp={message.creation} />
            </Box>

            : <MessageSenderAvatar userID={message.owner} user={user} isActive={isActive} />
        }
    </Box>

}

export const useGetUserDetails = (userID: string) => {

    const user = useGetUser(userID)

    const isActive = useIsUserActive(userID)

    return { user, isActive }
}

interface UserProps {
    user?: UserFields
    userID: string,
    isActive?: boolean
}
export const MessageSenderAvatar = memo(({ user, userID, isActive = false }: UserProps) => {

    const alt = user?.full_name ?? userID
    const isBot = user?.type === 'Bot'
    const color = useMemo(() => generateAvatarColor(user?.full_name ?? userID), [user?.full_name, userID])
    const availabilityStatus = user?.availability_status

    return <Theme accentColor={color}><span className="relative inline-block">
        <Avatar src={user?.user_image} alt={user?.full_name ?? userID} loading='lazy' fallback={getInitials(alt)} size={'2'} radius={'medium'} />

        {availabilityStatus && availabilityStatus === 'Away' &&
            <span className={clsx("absolute block translate-x-1/2 translate-y-1/2 transform rounded-full", 'bottom-0.5 right-0.5')}>
                <span className="block h-2 w-2 rounded-full border border-slate-2 bg-[#FFAA33] shadow-md" />
            </span>
        }

        {availabilityStatus && availabilityStatus === 'Do not disturb' &&
            <span className={clsx("absolute block translate-x-1/2 translate-y-1/2 transform rounded-full", 'bottom-0.5 right-0.5')}>
                <span className="block h-2 w-2 rounded-full border border-slate-2 bg-[#D22B2B] shadow-md" />
            </span>
        }

        {availabilityStatus !== 'Away' && availabilityStatus !== 'Do not disturb' && isActive &&
            <span className={clsx("absolute block translate-x-1/2 translate-y-1/2 transform rounded-full", 'bottom-0.5 right-0.5')}>
                <span className="block h-2 w-2 rounded-full border border-slate-2 bg-green-600 shadow-md" />
            </span>
        }

        {isBot && <span className="absolute block translate-x-1/2 translate-y-1/2 transform rounded-full bottom-0.5 right-0.5">
            <RiRobot2Fill className="text-accent-11 dark:text-accent-11" size="16px" />
        </span>}
    </span>
    </Theme>
})

export const UserHoverCard = memo(({ user, userID, isActive }: UserProps) => {

    const { isBot, fullName, userImage, availabilityStatus, customStatus } = useMemo(() => {
        return {
            fullName: user?.full_name ?? userID,
            availabilityStatus: user?.availability_status,
            customStatus: user?.custom_status,
            userImage: user?.user_image ?? '',
            isBot: user?.type === 'Bot'
        }
    }, [user, userID])
    return <HoverCard.Root>
        <HoverCard.Trigger>
            <Text className='text-gray-12 flex items-center gap-1' weight='medium' size='2'>
                {fullName} {isBot && <Badge color='gray' className='font-semibold px-1 py-0'>Bot</Badge>}
            </Text>
        </HoverCard.Trigger>
        <HoverCard.Content size='1'>
            <Stack>
                <Flex gap='2' align='center'>
                    <UserAvatar src={userImage} alt={fullName} size='4' isBot={isBot} />
                    <Flex direction='column'>
                        <Flex gap='3' align='center'>
                            <Text className='text-gray-12' weight='bold' size='3'>{fullName}</Text>
                            {/* if availabilityStatus is set to 'Invisible', don't show the status */}
                            {availabilityStatus && availabilityStatus !== 'Invisible' && <Flex className='text-gray-10 text-xs flex gap-1 items-center'>
                                {getStatusText(availabilityStatus)}
                            </Flex>}
                            {/* only show user active status if the user has not explicitly set their availability status */}
                            {!availabilityStatus && isActive && <Flex gap='1' align='center'>
                                <BsFillCircleFill color={'green'} size='8' />
                                <Text className='text-gray-10' size='1'>Online</Text>
                            </Flex>}
                        </Flex>
                        {user && !isBot && <OnLeaveBadge userID={user.name} />}
                        {customStatus ? <Text className='text-gray-11' size='1'>{customStatus}</Text> : user && !isBot && <Text className='text-gray-11' size='1'>{user?.name}</Text>}
                    </Flex>
                </Flex>

                <StartDMButton userID={userID} />
            </Stack>
        </HoverCard.Content>
    </HoverCard.Root>
})
type MessageContentProps = BoxProps & {
    user?: UserFields
    message: Message,
    forceHideLinkPreview?: boolean,
    isChannelReadOnly?: boolean,
}

const StartDMButton = ({ userID }: { userID: string }) => {

    const { call } = useContext(FrappeContext) as FrappeConfig

    const navigate = useNavigate()

    const { workspaceID } = useParams()

    const onClick = () => {
        if (userID) {
            call.post('raven.api.raven_channel.create_direct_message_channel', {
                user_id: userID
            }).then((res) => {
                navigate(`/${workspaceID}/${res?.message}`)
            }).catch(err => {
                toast.error('Could not create a DM channel', {
                    description: getErrorMessage(err)
                })
            })
        }

    }

    return <Button variant='soft' className='not-cal' size='1' onClick={onClick}>
        <BiChat size='14' /> Message
    </Button>

}
export const MessageContent = ({ message, user, forceHideLinkPreview = false, isChannelReadOnly = false, ...props }: MessageContentProps) => {

    return <Box className='flex flex-col gap-1' {...props}>
        {message.message_type === 'Image' && <ImageMessageBlock message={message} user={user} />}
        {message.message_type === 'File' && <FileMessageBlock message={message} user={user} />}
        {message.text ? <TiptapRenderer message={{
            ...message,
            message_type: 'Text'
        }} user={user} showLinkPreview={forceHideLinkPreview ? false : message.hide_link_preview ? false : true} /> : null}
        {message.message_type === 'Poll' && <PollMessageBlock message={message} user={user} isChannelReadOnly={isChannelReadOnly} />}
    </Box>
}