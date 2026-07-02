import { Fragment, memo } from "react"
import { MessageSquare } from "lucide-react"
import { cn } from "@lib/utils"
import { type NotificationObject } from "@stores/notifications/reducers"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { formatRelativeDate } from "@lib/date"
import _ from "@lib/translate"
import RichTextRenderer from "@components/features/message/renderers/RichTextRenderer"
import type { UserData } from "@db"
import type { SelectedNotification } from "./NotificationChat"

export const formatReactorNames = (names: string[], total: number): string => {
    if (total === 1) return names[0]
    if (total === 2) return _(`{0} and {1}`, [names[0], names[1]])
    if (total === 3) return _(`{0}, {1} and {2}`, [names[0], names[1], names[2]])
    return _(`{0}, {1} and {2} others`, [names[0], names[1], String(total - 2)])
}

const ChannelContext = ({
    notification,
}: {
    notification: Pick<NotificationObject, "is_thread" | "is_direct_message" | "channel_type" | "channel_name">
}) => {
    if (notification.is_thread) {
        return (
            <div className="flex items-center gap-1 text-xs text-ink-gray-4">
                <MessageSquare className="w-3 h-3" />
                <span>{_("Thread")}</span>
            </div>
        )
    }
    if (!notification.is_direct_message) {
        return (
            <div className="flex items-center gap-1 text-xs">
                <span className="text-ink-gray-4/80">{_("in")}</span>
                <ChannelIcon type={notification.channel_type} className="h-3 w-3 text-ink-gray-4" />
                <span className="font-medium text-ink-gray-8/70 group-hover:text-ink-gray-9 group-hover:underline transition-colors">
                    {notification.channel_name}
                </span>
            </div>
        )
    }
    return null
}

const rowShellClasses = (isRead: boolean | number, isActive: boolean) => cn(
    "group flex w-full items-start gap-3 px-2 py-3 md:py-2 text-sm rounded transition-colors relative text-left select-none",
    "hover:bg-surface-gray-3 active:bg-surface-gray-3",
    !isRead && !isActive && "bg-surface-gray-2/10",
    isActive && "bg-surface-elevation-3 hover:bg-surface-elevation-3 active:bg-surface-elevation-3 shadow-sm"
)

/** Avatar + name + relative date + channel context line, with the body content
 * below. Same shape as `MessageSenderLayout` — header on top, `pt-1` wrapper
 * keeps the gap to content consistent (only here; continuation-style rows
 * never apply to notification rows so there's no branch). */
const NotificationRowLayout = ({
    isRead,
    isActive,
    onClick,
    avatar,
    name,
    relativeDate,
    channelContext,
    children,
}: {
    isRead: boolean | number
    isActive: boolean
    onClick: () => void
    avatar: React.ReactNode
    name: string
    relativeDate: string
    channelContext?: React.ReactNode
    children: React.ReactNode
}) => (
    <button type="button" onClick={onClick} className="block w-full cursor-pointer px-2 py-0.5">
        <div className={rowShellClasses(isRead, isActive)}>
            {avatar}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={cn("text-sm", !isRead ? "font-semibold" : "font-medium")}>
                        {name}
                    </span>
                    <span className="text-xs font-regular text-ink-gray-4 shrink-0">
                        {relativeDate}
                    </span>
                    {channelContext}
                </div>
                <div className="pt-1">
                    {children}
                </div>
            </div>
        </div>
    </button>
)

const UnreadDot = () => (
    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-surface-blue-5" />
)

/** Body preview for a notification. Prefers the rich `text` (Tiptap HTML); when
 * empty (File/Poll/Image messages, or text-less custom types) falls back to the
 * plain-text `content` field maintained server-side. */
const NotificationBody = ({ notification }: { notification: NotificationObject }) => {
    if (notification.text) return <RichTextRenderer html={notification.text} />
    if (notification.content) return <span>{notification.content}</span>
    return <span>{_("Message")}</span>
}

/** Single-string template with a `{0}` placeholder for the emoji slot — keeps
 * the sentence atomic for translators (word order varies across languages),
 * then splices the emoji JSX (mix of <img> for custom + text for unicode) at
 * render time. */
const renderReactedSentence = (reactions: { reaction: string; is_custom: 0 | 1 }[]) => {
    const hasReactions = reactions.length > 0
    const template = hasReactions
        ? _("Reacted {0} to your message.")
        : _("Reacted to your message.")
    if (!hasReactions) return template
    const [before, after = ""] = template.split("{0}")
    return (
        <>
            {before}
            <span className="inline-flex items-center gap-0.5 align-middle">
                {reactions.map((r, i) => (
                    <Fragment key={i}>
                        {i > 0 && <span>,&nbsp;</span>}
                        {r.is_custom ? (
                            <img
                                src={r.reaction}
                                alt=""
                                loading="lazy"
                                className="h-4 w-4 inline-block"
                            />
                        ) : (
                            <span className="text-base leading-none">{r.reaction}</span>
                        )}
                    </Fragment>
                ))}
            </span>
            {after}
        </>
    )
}

export const MentionItem = memo(({
    notification,
    sender,
    isActive,
    onSelect,
}: {
    notification: NotificationObject
    sender?: UserData
    isActive: boolean
    onSelect: (selection: SelectedNotification) => void
}) => {
    const handleClick = () => {
        onSelect({
            channelID: notification.channel_id,
            messageID: notification.message_id,
            isThread: !!notification.is_thread,
            isDirectMessage: !!notification.is_direct_message,
            peer: notification.is_direct_message ? sender : undefined,
        })
    }
    return (
        <NotificationRowLayout
            isRead={notification.is_read}
            isActive={isActive}
            onClick={handleClick}
            avatar={
                <div className="relative shrink-0">
                    {sender && <UserAvatar user={sender} size="md" />}
                    {!notification.is_read && <UnreadDot />}
                </div>
            }
            name={sender?.full_name ?? notification.owner}
            relativeDate={formatRelativeDate(notification.creation)}
            channelContext={<ChannelContext notification={notification} />}
        >
            <div className="line-clamp-2">
                <NotificationBody notification={notification} />
            </div>
        </NotificationRowLayout>
    )
})

export const ReactionItem = memo(({
    notification,
    usersById,
    isActive,
    onSelect,
}: {
    notification: NotificationObject
    usersById: Map<string, UserData>
    isActive: boolean
    onSelect: (selection: SelectedNotification) => void
}) => {
    const reactors = notification.reactors ?? []
    const total = reactors.length
    // formatReactorNames uses 3 names when total<=3, else only 2.
    const namesNeeded = total <= 3 ? total : 2
    // O(1) Map lookups against the shared users snapshot — avoids a per-row
    // Dexie `useLiveQuery` subscription (would be N observers for N rows).
    const reactorsData = reactors.slice(0, namesNeeded).map((id) => usersById.get(id))

    const names = reactorsData.map((u, i) => u?.full_name ?? reactors[i])
    const reactorText = formatReactorNames(names, total)
    const displayReactions = (notification.reactions ?? []).slice(0, 5)

    const handleClick = () => {
        onSelect({
            channelID: notification.channel_id,
            messageID: notification.message_id,
            isDirectMessage: !!notification.is_direct_message,
            peer: notification.is_direct_message ? reactorsData[0] : undefined,
            isThread: !!notification.is_thread,
        })
    }

    return (
        <NotificationRowLayout
            isRead={notification.is_read}
            isActive={isActive}
            onClick={handleClick}
            avatar={
                <div className="relative shrink-0 w-8 h-8">
                    {reactorsData[0] && (
                        <div className={cn("absolute", total > 1 ? "top-0 left-0 w-6 h-6" : "inset-0")}>
                            <UserAvatar user={reactorsData[0]} size={total > 1 ? "xs" : "md"} />
                        </div>
                    )}
                    {reactorsData[1] && total > 1 && (
                        <div className="absolute bottom-0 right-0 w-5 h-5 ring-1 ring-surface-gray-1 rounded-full overflow-hidden">
                            <UserAvatar user={reactorsData[1]} size="xs" />
                        </div>
                    )}
                    {!notification.is_read && <UnreadDot />}
                </div>
            }
            name={reactorText}
            relativeDate={formatRelativeDate(notification.creation)}
            channelContext={<ChannelContext notification={notification} />}
        >
            <p className="flex items-center gap-1.5 text-sm text-ink-gray-8">
                {renderReactedSentence(displayReactions)}
            </p>
            <div className="mt-2 border-l-2 border-outline-gray-2 pl-2 text-xs text-ink-gray-4 line-clamp-2 [&_p]:my-0">
                <NotificationBody notification={notification} />
            </div>
        </NotificationRowLayout>
    )
})
