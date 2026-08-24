import { useNavigate } from "react-router-dom"
import { useMessageBatch } from "@hooks/useMessageBatch"
import { useChannelById } from "@stores/channels/useChannelList"
import ChannelHeader from "@components/features/channel/ChannelHeader/ChannelHeader"
import { DMChannelHeader } from "@components/features/dm-channel/DMChannelHeader"
import { ChatContentView } from "@components/features/message/ChatContentView"
import { Empty, EmptyHeader, EmptyDescription, EmptyMedia } from "@components/ui/empty"
import _ from "@lib/translate"
import { Island } from "@components/layout/Island"
import type { UserData } from "@db"
import ThreadDrawer from "@components/features/message/ThreadDrawer"
import { MessageCircleIcon } from "lucide-react"

/** Selection payload a list row hands to its host's onSelect. Every host
 * (notifications, search, saved messages) encodes it into its chat child route —
 * path params + nav state, rendered by NotificationChatRoute in the right pane. */
export type SelectedNotification = {
    channelID: string
    messageID: string
    isDirectMessage: boolean
    peer?: UserData,
    isThread: boolean
}

export function NotificationsEmptyState({ message }: { message?: string }) {
    return (
        <div className="h-full p-0 md:p-1">
            <Island className="h-full">
                <Empty>
                    <EmptyMedia>
                        <MessageCircleIcon />
                    </EmptyMedia>
                    <EmptyHeader>
                        <EmptyDescription>
                            {message ?? _("Select a notification to view the message.")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </Island>
        </div>
    )
}

/**
 * The chat pane a notification opens: a thread island for thread notifications,
 * otherwise the channel/DM header + chat. Shared by the state-driven pages
 * (Search / Saved Messages via NotificationChat below) and the notifications
 * page's route (NotificationChatRoute).
 */
export function NotificationPane({
    channelID,
    isThread,
    isDirectMessage,
    peer,
    initialMessageID,
    onCloseThread,
}: {
    channelID: string
    isThread: boolean
    isDirectMessage: boolean
    peer?: UserData
    /** Open the chat already centered on this message (see ChatStreamProps). */
    initialMessageID?: string | null
    /** Close handler for the thread pane's X/Esc — omit where closing isn't meaningful. */
    onCloseThread?: () => void
}) {
    const navigate = useNavigate()
    const channel = useChannelById(channelID)

    // Thread pane: resolve the parent channel from the thread's root message (a thread's
    // id IS its root message's id). One get_message_batch call — same SWR key as
    // ThreadRootMessage, so this dedupes with the fetch the drawer makes anyway. Gives
    // the drawer its parent context — which also enables its "Open channel" button.
    const { anchor: rootMessage } = useMessageBatch(isThread ? channelID : null)

    if (isThread) {
        return <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-1 p-0 md:p-1">
            {/* Chat island: header + stream + input */}
            <Island className="flex-1">
                <ThreadDrawer
                    threadID={channelID}
                    parentChannelID={rootMessage?.channel_id}
                    showOpenChannel
                    onClose={onCloseThread ?? (() => { })}
                    initialMessageID={initialMessageID}
                />
            </Island>
        </div>
    }

    // "Open channel": leave the pane for the channel's full page, landing on the same
    // message. Channels need their workspace for the URL — wait for the store if needed.
    const openChannel = () => {
        const base = isDirectMessage
            ? `/dm-channel/${encodeURIComponent(channelID)}`
            : `/${encodeURIComponent(channel?.workspace ?? "")}/${encodeURIComponent(channelID)}`
        navigate(initialMessageID ? `${base}?message_id=${encodeURIComponent(initialMessageID)}` : base)
    }
    const canOpenChannel = isDirectMessage || !!channel?.workspace

    // showActions={false} trims the header for the narrow desktop pane (no room for
    // the drawer rail). The headers themselves keep the actions on MOBILE regardless —
    // drawers are bottom sheets there (no space cost, correctly keyed via
    // CurrentChannelContext) — so no breakpoint handling is needed here.
    const header = isDirectMessage
        ? peer
            ? <DMChannelHeader peer={peer} channelID={channelID} showActions={false} onOpenChannel={openChannel} />
            : null
        : <ChannelHeader channelID={channelID} showActions={false} onOpenChannel={canOpenChannel ? openChannel : undefined} />

    return (
        <ChatContentView
            channelID={channelID}
            header={header}
            // Open the channel already centered on the notification's message (one fetch,
            // no race with a plain "latest messages" load).
            initialMessageID={initialMessageID}
        />
    )
}

