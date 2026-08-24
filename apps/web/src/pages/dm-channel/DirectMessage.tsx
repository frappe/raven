import { Navigate } from "react-router-dom"
import { DMChannelHeader } from "@components/features/dm-channel/DMChannelHeader"
import { DirectMessagePageSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { ChatContentView } from "@components/features/message/ChatContentView"
import { useUser } from "@hooks/useUser"
import { useCurrentChannelID } from "@hooks/useCurrentChannelID"
import _ from "@lib/translate"
import { useChannel } from "@hooks/useChannel"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@components/ui/empty"

export default function DirectMessage() {
    const channelID = useCurrentChannelID()
    const { dmChannel, isLoading } = useChannel(channelID)

    const peerUser = useUser(dmChannel?.peer_user_id || "")

    if (!channelID) {
        return <Navigate to="/dm-channel" replace />
    }

    // Users are loaded app-wide before this renders, so the only real wait here
    // is the channel list — gate the skeleton on that, not the (sync) peer lookup.
    if (isLoading) {
        return <DirectMessagePageSkeleton />
    }

    if (!peerUser) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{_("Conversation not found")}</EmptyTitle>
                    <EmptyDescription>{_("This direct message may have been removed or you don’t have access.")}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    return (
        <ChatContentView
            channelID={channelID}
            header={<DMChannelHeader peer={peerUser} channelID={channelID} />}
        />
    )
}
