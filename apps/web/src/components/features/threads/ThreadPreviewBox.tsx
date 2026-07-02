import { cn } from "@lib/utils"
import { RESULT_ROW_ACTIVE_CLASS } from "@components/common/MessageResultBlock/MessageResultBlock"
import { UserData } from "@db"
import { BaseThreadMessage } from "@components/common/BaseThreadMessage"
import { ThreadChannelDetails } from "./ThreadsList"
import { ThreadMessage } from "src/types/ThreadMessage"
import { formatRelativeDate } from "@lib/date"

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
        <div className="px-2 py-0.5">
            <div
                onClick={onClick}
                className={cn(
                    "group block rounded px-6 py-4 transition-colors relative cursor-pointer select-none",
                    "hover:bg-surface-gray-3 focus:outline-none focus-visible:bg-surface-gray-3",
                    isActive && RESULT_ROW_ACTIVE_CLASS,
                    isUnread && !isActive && "bg-surface-gray-1"
                )}
            >
                {/* Connecting line from avatar to participants - only show for non-DM threads */}
                {!channelDetails.isDirectMessage && (
                    <div className="absolute top-20 left-10 w-7 h-[calc(100%-6.75rem)] border-l border-b border-outline-gray-2 rounded-bl-lg z-0" />
                )}

                {/* Header: Channel name and date */}
                {channelDetails.channelName && (
                    <div className="flex items-center gap-2 mb-3 relative z-10">
                        {channelDetails.channelIcon && (
                            <span>{channelDetails.channelIcon}</span>
                        )}
                        <span className="font-medium text-xs">{channelDetails.channelName}</span>
                        <span className="text-xs text-ink-gray-4">{formatRelativeDate(thread.last_message_timestamp)}</span>
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
