import { useEffect } from "react"
import { useSetAtom } from "jotai"
import ChannelHeader from "@components/features/channel/ChannelHeader/ChannelHeader"
import { DMChannelHeader } from "@components/features/dm-channel/DMChannelHeader"
import { ChatContentView } from "@components/features/message/ChatContentView"
import { messageTargetAtom } from "@utils/channelAtoms"
import { Empty, EmptyHeader, EmptyDescription } from "@components/ui/empty"
import _ from "@lib/translate"
import { Island } from "@components/layout/Island"
import type { UserData } from "@db"
import ThreadDrawer from "@components/features/message/ThreadDrawer"

/** Right-pane selection on the notifications page. Owned by `Notifications`
 * (useState there) and passed in — cleared automatically when the component unmounts on route change. */
export type SelectedNotification = {
    channelID: string
    messageID: string
    isDirectMessage: boolean
    peer?: UserData,
    isThread: boolean
}

export function NotificationsEmptyState() {
    return (
        <div className="h-full p-0 md:p-1">
            <Island className="h-full">
                <Empty>
                    <EmptyHeader>
                        <EmptyDescription>
                            {_("Select a notification to view the details.")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </Island>
        </div>
    )
}

export default function NotificationChat({ selected }: { selected: SelectedNotification | null }) {
    const isThread = selected?.isThread ?? false
    const channelID = selected?.channelID ?? ""
    const setMessageTarget = useSetAtom(messageTargetAtom(channelID))

    // Seed the per-channel target atom so ChatStream/useStreamScroll jumps to
    // the notification's message. ChatStream resets the atom after settling,
    // so a fresh notification click always re-fires this effect.
    useEffect(() => {
        if (!selected) return
        setMessageTarget(selected.messageID)
    }, [selected, setMessageTarget])

    if (!selected) return <NotificationsEmptyState />

    if (isThread) {
        return <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-1 p-0 md:p-1">
            {/* Chat island: header + stream + input */}
            <Island className="flex-1">
                <ThreadDrawer threadID={selected.channelID} onClose={() => { }} />
            </Island>
        </div>
    }

    const header = selected.isDirectMessage
        ? selected.peer
            ? <DMChannelHeader peer={selected.peer} channelID={selected.channelID} />
            : null
        : <ChannelHeader channelID={selected.channelID} />

    return (
        <ChatContentView
            channelID={selected.channelID}
            header={header}
        />
    )
}
