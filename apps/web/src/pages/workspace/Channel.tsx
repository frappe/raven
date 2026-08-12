import { useEffect } from "react"
import { useParams } from "react-router-dom"
import { useSetAtom } from "jotai"
import ChannelHeader from "@components/features/channel/ChannelHeader/ChannelHeader"
import { ChatContentView } from "@components/features/message/ChatContentView"
import { useCurrentChannelID } from "@hooks/useCurrentChannelID"
import { useChannel } from "@hooks/useChannel"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"

export default function Channel() {
    const channelID = useCurrentChannelID()
    const { workspaceID } = useParams<{ workspaceID: string }>()
    const { channel } = useChannel(channelID)

    // Feed the home redirect's "reopen where I left off" memory — written as
    // a workspace+channel pair so a stale channel can't leak across workspaces
    const setLastWorkspace = useSetAtom(lastWorkspaceAtom)
    const setLastChannel = useSetAtom(lastChannelAtom)
    useEffect(() => {
        if (workspaceID && channelID) {
            setLastWorkspace(workspaceID)
            setLastChannel(channelID)
        }
    }, [workspaceID, channelID, setLastWorkspace, setLastChannel])

    return (
        <ChatContentView
            channelID={channelID}
            header={<ChannelHeader channelID={channelID} />}
        />
    )
}
