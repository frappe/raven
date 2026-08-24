import { memo } from "react"
import { MessageSquareMore } from "lucide-react"
import { Message } from "@raven/types/common/Message"
import { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import { UserData } from "@db"
import { WorkspaceFields } from "@hooks/useWorkspaces"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { MessageContent, MessageBody } from "@components/features/message/renderers/MessageContent"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { formatRelativeDate } from "@lib/date"
import { cn } from "@lib/utils"

/** Pass via `className` to mark the open/selected row in a split view (search, etc.). */
export const RESULT_ROW_ACTIVE_CLASS = "bg-surface-elevation-3 hover:bg-surface-elevation-3 active:bg-surface-elevation-3 shadow-sm"

interface MessageResultBlockProps {
    message: Message
    /** Author of the message — resolved at parent (e.g. via a users Map). */
    user?: UserData
    /** Channel context — non-null for channel messages. */
    channel?: ChannelListItem
    /** DM channel context — non-null for DM messages. */
    dmChannel?: DMChannelListItem
    /** Peer user when message lives in a DM. */
    peer?: UserData
    /** Workspace the channel belongs to. */
    workspace?: WorkspaceFields
    onClick?: () => void
    className?: string
}

const MessageResultBlockInner = ({ message, user, channel, dmChannel, peer, workspace, onClick, className }: MessageResultBlockProps) => {

    const handleKeyDown = onClick
        ? (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
            }
        }
        : undefined

    const relativeDate = formatRelativeDate(message.creation)
    const peerName = peer?.full_name ?? dmChannel?.peer_user_id ?? ""

    // Spacing wrapper + rounded shell, mirroring the notifications list rows.
    return (
        <div className="px-2 py-0.5">
            <div
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
                onClick={onClick}
                onKeyDown={handleKeyDown}
                className={cn(
                    "group flex gap-3 px-2 py-3 md:py-2 rounded transition-colors text-left select-none",
                    onClick && "cursor-pointer hover:bg-surface-gray-3 active:bg-surface-gray-3 focus-visible:bg-surface-gray-3 focus-visible:outline-none",
                    className
                )}
            >
                {user && <UserAvatar user={user} size="md" showStatusIndicator={false} />}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap text-content">
                        {user && (
                            <span className="font-medium text-ink-gray-8 truncate">{user.full_name}</span>
                        )}
                        <span className="shrink-0 text-xs text-ink-gray-4">{relativeDate}</span>
                        {workspace && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <span className="text-ink-gray-4 truncate min-w-0">{workspace.workspace_name}</span>
                            </>
                        )}
                        {channel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <ChannelIcon type={channel.type} className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{channel.channel_name}</span>
                            </>
                        )}
                        {dmChannel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <MessageSquareMore className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{peerName}</span>
                            </>
                        )}
                    </div>
                    {/* Mentions are INERT on mobile (max-md pointer-events-none): the row
                        is one tap target, and a live mention double-fired — the tap
                        opened the profile popover AND navigated the row, and the popover
                        outlived the page (portaled outside the layer that went inert).
                        Desktop keeps hover cards: hover never conflicts with click
                        navigation. Same rule as BaseThreadMessage. */}
                    <div className="mt-1 [&_p]:my-0 max-md:[&_.mention]:pointer-events-none">
                        {/* Polls: render the FTS snippet (question + options, with <mark>
                            highlights) instead of the live poll card — a votable card in a
                            search list would fire get_poll per row and drop the highlight. */}
                        {message.message_type === "Poll"
                            ? <MessageBody content={message.text} />
                            : <MessageContent message={message} showLinkPreview={false} />}
                    </div>
                </div>
            </div>
        </div>
    )
}

export const MessageResultBlock = memo(MessageResultBlockInner)
