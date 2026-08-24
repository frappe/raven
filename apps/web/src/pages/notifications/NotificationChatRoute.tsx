import { useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { useSetAtom } from "jotai"
import { messageTargetAtom, makeMessageTarget } from "@utils/channelAtoms"
import { useChannelById, useChannels } from "@stores/channels/useChannelList"
import { useUser } from "@hooks/useUser"
import type { DMChannelListItem } from "@raven/types/common/ChannelListItem"
import { NotificationPane } from "./NotificationChat"

/** Context the notification click sends along with the navigation. Absent on a cold
 *  deep-link (pasted URL / refresh), where everything is derived instead. */
type NotificationNavState = {
    isThread?: boolean
    isDirectMessage?: boolean
    peerID?: string
} | null

/**
 * Router glue for the chat-pane child routes — `/notifications/:channelID/:messageID?`,
 * `/search/:channelID/:messageID` and `/saved-messages/:channelID/:messageID`. The pane
 * is a ROUTE, so opening a chat is a history entry: the mobile back-swipe closes it
 * instead of leaving the host page, and a refresh restores the open chat.
 */
export default function NotificationChatRoute() {
    const { channelID = "", messageID = "" } = useParams<{ channelID: string; messageID?: string }>()
    const navigate = useNavigate()
    const location = useLocation()
    const navState = (location.state ?? null) as NotificationNavState

    // The host's list route: strip this route's own params off the path. The query string
    // stays — on /search it carries the active query/filters.
    const listPath = {
        pathname: location.pathname.split("/").slice(0, messageID ? -2 : -1).join("/") || "/",
        search: location.search,
    }

    // The click passes thread/DM context in navigation state; a cold deep-link derives
    // it from the channel store instead. Threads aren't in the store — "unknown id once
    // the list has loaded" means thread.
    const { isLoading } = useChannels()
    const channel = useChannelById(channelID)
    const isThread = navState?.isThread ?? (!isLoading && !channel)
    const isDirectMessage = navState?.isDirectMessage ?? channel?.is_direct_message === 1
    const peerID = navState?.peerID ?? (channel as DMChannelListItem | undefined)?.peer_user_id
    const peer = useUser(peerID ?? "")

    // Ask the stream to scroll to the message. Keyed on location.key: re-clicking the
    // same notification navigates to the same URL but still gets a new key, so every
    // click re-centers — even after the user scrolled away.
    const setMessageTarget = useSetAtom(messageTargetAtom(channelID))
    useEffect(() => {
        if (messageID) setMessageTarget(makeMessageTarget(messageID))
    }, [location.key, messageID, setMessageTarget])

    if (!channelID) return null
    // Cold deep-link: wait for the channel list before classifying channel vs thread.
    if (isLoading && !navState) return null

    return (
        <NotificationPane
            channelID={channelID}
            isThread={isThread}
            isDirectMessage={isDirectMessage}
            peer={peer ?? undefined}
            initialMessageID={messageID}
            onCloseThread={() => navigate(listPath)}
        />
    )
}
