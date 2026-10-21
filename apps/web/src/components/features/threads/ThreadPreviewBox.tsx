import { cn } from "@lib/utils"
import { RESULT_ROW_ACTIVE_CLASS } from "@components/common/MessageResultBlock/MessageResultBlock"
import { UserData } from "@db"
import { BaseThreadMessage } from "@components/common/BaseThreadMessage"
import { ThreadChannelDetails } from "./ThreadsList"
import { ThreadMessage } from "src/types/ThreadMessage"
import { formatRelativeDate } from "@lib/date"
import { UnreadDot } from "@components/common/UnreadDot"

interface ThreadPreviewBoxProps {
    user: UserData | null
    thread: ThreadMessage
    isUnread: boolean
    /** Live reply count (threadMetaStore); falls back to thread.reply_count in BaseThreadMessage. */
    replyCount?: number
    channelDetails: ThreadChannelDetails
    onClick?: () => void
    isActive?: boolean
}

export const ThreadPreviewBox = ({
    user,
    thread,
    isUnread,
    replyCount,
    channelDetails,
    onClick,
    isActive
}: ThreadPreviewBoxProps) => {

    return (
        <div className="md:px-2 py-0.5">
            <div
                onClick={onClick}
                className={cn(
                    "group block md:rounded px-3 py-4 transition-colors relative cursor-pointer select-none",
                    "hover:bg-surface-gray-3 active:bg-surface-gray-3 focus:outline-none focus-visible:bg-surface-gray-3",
                    isActive && RESULT_ROW_ACTIVE_CLASS,
                )}
            >
                {/* Connecting line from avatar down to the participants / reply-count row. */}
                <div className="absolute top-20 left-7 w-7 h-[calc(100%-6.75rem)] border-l border-b border-outline-gray-2 rounded-bl-lg z-0" />

                {/* Header: Channel name and date */}
                {channelDetails.channelName && (
                    <div className="flex items-baseline gap-2.5 mb-3.5 relative z-10">
                        <div className="flex items-baseline gap-1">
                            {channelDetails.channelIcon && (
                                <span className="flex h-lh self-center items-center text-sm">{channelDetails.channelIcon}</span>
                            )}
                            <span className="text-sm-medium">{channelDetails.channelName}</span>
                        </div>
                        <span className="text-xs text-ink-gray-6">{formatRelativeDate(thread.last_message_timestamp)}</span>
                        {isUnread && <UnreadDot className="self-center text-xs" />}
                    </div>
                )}

                <BaseThreadMessage
                    user={user}
                    channelDetails={channelDetails}
                    showConnectorLine={false}
                    thread={thread}
                    replyCount={replyCount}
                    isUnread={isUnread}
                />
            </div>
        </div>
    )
}
