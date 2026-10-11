import { useEffect } from "react"
import { useParams } from "react-router-dom"
import { useSetAtom } from "jotai"
import ChannelHeader from "@components/features/channel/ChannelHeader/ChannelHeader"
import { ChatContentView } from "@components/features/message/ChatContentView"
import { ChannelPageSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { useCurrentChannelID } from "@hooks/useCurrentChannelID"
import { useChannel } from "@hooks/useChannel"
import { useEnsureChannel } from "@hooks/useEnsureChannel"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@components/ui/empty"
import { Button } from "@components/ui/button"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import _ from "@lib/translate"

export default function Channel() {
    const channelID = useCurrentChannelID()
    const { workspaceID } = useParams<{ workspaceID: string }>()
    const { channel, dmChannel, isLoading } = useChannel(channelID)
    // Same hole as the DM page: a channel created while the app was backgrounded
    // (join, mention in a new channel) isn't in the list when its notification
    // opens this page. "Found" means the store has the id, whatever its type —
    // the lookup can't change a channel's type, so a found one never needs it.
    const found = Boolean(channel || dmChannel)
    const { checking, failed, retry } = useEnsureChannel(channelID, found)

    // Feed the home redirect's "reopen where I left off" memory — written as
    // a workspace+channel pair so a stale channel can't leak across workspaces.
    // Only once the channel is real: recording a missing one would make the
    // home redirect reopen this not-found page forever.
    const setLastWorkspace = useSetAtom(lastWorkspaceAtom)
    const setLastChannel = useSetAtom(lastChannelAtom)
    useEffect(() => {
        if (workspaceID && channelID && found) {
            setLastWorkspace(workspaceID)
            setLastChannel(channelID)
        }
    }, [workspaceID, channelID, found, setLastWorkspace, setLastChannel])

    if (isLoading || checking) {
        return <ChannelPageSkeleton />
    }

    // The lookup failed, so the channel may still exist: don't call it missing.
    if (!found && failed) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{_("Couldn’t load this channel")}</EmptyTitle>
                    <EmptyDescription>{_("Check your connection and try again.")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" onClick={retry}>{_("Try again")}</Button>
                </EmptyContent>
            </Empty>
        )
    }

    if (!found) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{_("Channel not found")}</EmptyTitle>
                    <EmptyDescription>{_("This channel may have been deleted or you don’t have access.")}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    return (
        <ChatContentView
            channelID={channelID}
            header={<ChannelHeader channelID={channelID} />}
        />
    )
}
