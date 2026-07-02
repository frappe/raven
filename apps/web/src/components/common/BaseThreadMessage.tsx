import { MessageContent } from "@components/features/message/renderers/MessageContent"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { ThreadChannelDetails } from "@components/features/threads/ThreadsList"
import { Badge } from "@components/ui/badge"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import { UserData } from "@db"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { Message } from "@raven/types/common/Message"
import { ThreadMessage } from "src/types/ThreadMessage"

interface BaseThreadMessageProps {
    user: UserData | null
    thread: ThreadMessage
    channelDetails: ThreadChannelDetails
    showConnectorLine?: boolean
    /** Live reply count (threadMetaStore). Falls back to the row's `reply_count` when absent. */
    replyCount?: number
    /** Shows an unread presence dot beside the reply count. */
    isUnread?: boolean
}

export const BaseThreadMessage = ({
    user,
    thread,
    channelDetails,
    replyCount,
    isUnread
}: BaseThreadMessageProps) => {
    const count = replyCount ?? thread.reply_count ?? 0
    return (
        <div className="relative">

            {/* Author and message */}
            <div className="flex items-start gap-3 relative z-10">
                <div className="shrink-0">
                    {user ? <UserAvatar user={user} size="md" /> : <div className="w-10 h-10 rounded-full bg-surface-gray-2" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-base md:text-sm text-ink-gray-8 mb-1">
                        {user?.full_name || user?.name || _("User")}
                    </div>
                    <div className="[&_p]:my-0">
                        <MessageContent message={thread as unknown as Message} />
                    </div>
                </div>
            </div>

            {/* Participants and reply count */}
            <div className="flex items-center gap-2 mt-3 ml-12 relative z-10">
                {!channelDetails.isDirectMessage ? (
                    <GroupedAvatars users={channelDetails.participants} max={3} size="xs" />
                ) : null}
                {count > 0 ? (
                    <span className={cn("text-xs text-ink-gray-8", isUnread ? "font-bold" : "font-semibold")}>
                        {_(`${count} ${count === 1 ? 'Reply' : 'Replies'}`)}
                    </span>
                ) : null}
                {isUnread && (
                    <Badge variant="solid" className="w-1 h-1 p-0 min-w-0 rounded-full mt-0.5" aria-label={_("Unread")} />
                )}
            </div>
        </div>
    )
}

