import { Navigate } from "react-router-dom"
import { DMChannelHeader } from "@components/features/dm-channel/DMChannelHeader"
import { DirectMessagePageSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { ChatContentView } from "@components/features/message/ChatContentView"
import { useUser } from "@hooks/useUser"
import { useCurrentChannelID } from "@hooks/useCurrentChannelID"
import _ from "@lib/translate"
import { useChannel } from "@hooks/useChannel"
import { useEnsureChannel } from "@hooks/useEnsureChannel"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@components/ui/empty"
import { Button } from "@components/ui/button"

export default function DirectMessage() {
    const channelID = useCurrentChannelID()
    const { dmChannel, isLoading } = useChannel(channelID)
    const { checking, failed, retry } = useEnsureChannel(channelID, Boolean(dmChannel))

    const peerUser = useUser(dmChannel?.peer_user_id || "")

    if (!channelID) {
        return <Navigate to="/dm-channel" replace />
    }

    // Users are loaded app-wide before this renders, so the only real wait here
    // is the channel list — gate the skeleton on that, not the (sync) peer lookup.
    if (isLoading || checking) {
        return <DirectMessagePageSkeleton />
    }

    // The lookup failed, so the conversation may still exist: don't call it missing.
    if (!peerUser && failed) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{_("Couldn’t load this conversation")}</EmptyTitle>
                    <EmptyDescription>{_("Check your connection and try again.")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" onClick={retry}>{_("Try again")}</Button>
                </EmptyContent>
            </Empty>
        )
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
