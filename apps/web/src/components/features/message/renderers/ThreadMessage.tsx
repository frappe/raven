import { useContext, useEffect, useRef } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import type { UserData } from "@db"
import { useSetAtom } from "jotai"
import { channelDrawerAtom, pollDrawerAtom } from "@utils/channelAtoms"
import { useChannelById } from "@stores/channels/useChannelList"
import { useChannelMembers } from "@hooks/useChannelMembers"
import { loadThreadDetails, useThreadReplyCount } from "@stores/threads/useThreadMeta"
import { subscribeConnectionEpoch } from "@stores/connectionFreshness"
import { useInView } from "@hooks/useHasBeenInView"
import { NavLink, useLocation } from "react-router-dom"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

interface ThreadButtonProps {
    participants: UserData[]
    messageCount: number
    threadID?: string
    /** The thread's PARENT channel (the message's channel_id). Lets the pill build the
     *  real channel thread route even when the chat is rendered in a pane
     *  (notifications/search/saved), where the URL carries no channel. */
    channelID: string
}

export const ThreadButton = ({ participants, messageCount, threadID, channelID }: ThreadButtonProps) => {
    const location = useLocation()
    const drawerChannelID = channelID
    const setDrawerType = useSetAtom(channelDrawerAtom(drawerChannelID))
    const setPollDrawer = useSetAtom(pollDrawerAtom(drawerChannelID))
    const parentChannel = useChannelById(channelID ?? "")

    // Opening a thread takes over the rail — clear the poll + context drawers so the thread
    // shows. Needed on a RE-click too (when a poll already overlays this thread): the route
    // doesn't change, so only the click carries the intent to return to the thread.
    const openThread = () => {
        setDrawerType("")
        setPollDrawer(null)
    }

    const content = (
        <>
            <GroupedAvatars users={participants} max={4} size="xs" />
            <span className="text-sm">{messageCount === 1 ? _("1 reply") : _("{0} replies", [String(messageCount)])}</span>
        </>
    )
    const className = "flex w-fit ml-11 mt-2 items-center gap-2 text-ink-gray-6 transition-colors duration-200 hover:text-ink-gray-8"

    // No threadID → render non-interactive (shouldn't happen for a real pill).
    if (!threadID) return <div className={cn("ml-11 mt-2", className)}>{content}</div>

    // Destination: the thread route under its REAL parent channel, resolved from the
    // channel store — so the pill works from anywhere, including the notification/
    // search/saved panes where the URL carries no channel. On the channel/DM pages this
    // resolves to the same base the URL would give. Fallback (channel not in the store,
    // e.g. a message inside a thread stream): derive from the current path by stripping
    // any open `/thread/...`, as before. Closing the channel drawer is a click
    // side-effect (navigating to a thread shouldn't leave the members/files drawer open).
    const base = parentChannel
        ? parentChannel.is_direct_message === 1
            ? `/dm-channel/${encodeURIComponent(parentChannel.name)}`
            : `/${encodeURIComponent(parentChannel.workspace ?? "")}/${encodeURIComponent(parentChannel.name)}`
        : location.pathname.split("/thread")[0]
    const inThread = location.pathname.includes("/thread/")
    // Already viewing the channel → just open the thread beside it, don't move the
    // channel. Coming from ELSEWHERE (notifications/search/saved pane) → the channel is
    // opening fresh, so also select the thread's ROOT message in it (thread id = root
    // message id) — the conversation's place in the channel is visible on arrival.
    const onChannelRoute = location.pathname.startsWith(base)
    const to = onChannelRoute
        ? `${base}/thread/${threadID}`
        : `${base}/thread/${threadID}?message_id=${encodeURIComponent(threadID)}`

    return (
        // Push on the FIRST thread open, so one back closes the thread and returns to the
        // channel (an unconditional `replace` made back skip straight past the channel).
        // Replace when a thread is already open, so back never cycles through threads.
        <NavLink to={to} replace={inThread} onClick={openThread} className={({ isActive }) => cn(className, isActive && "text-ink-gray-9")}>
            {content}
        </NavLink>
    )
}

/** Placeholder pill (reserves the row's height) shown until the thread details load. */
const ThreadPillSkeleton = () => (
    <div className="ml-11 mt-2 flex w-fit items-center gap-2 text-ink-gray-5">
        <div className="flex -space-x-2 text-xs">
            <span className="size-6 rounded-full border-2 border-surface-base bg-surface-gray-3" />
            <span className="size-6 rounded-full border-2 border-surface-base bg-surface-gray-3" />
        </div>
        <span className="text-sm">{_("View thread")}</span>
    </div>
)

const LoadedThreadPill = ({ threadID, channelID, isInView }: { threadID: string; channelID: string; isInView: boolean }) => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    // Fetch each time the pill comes on screen. The first time seeds the count +
    // members; after that it's a no-op — unless the connection broke while the pill
    // was off screen, in which case the count is suspect and gets refetched.
    // (loadThreadDetails decides; a stable connection never refetches.)
    useEffect(() => {
        if (isInView) loadThreadDetails(call, threadID)
    }, [isInView, call, threadID])

    // And if the connection breaks while the pill is ALREADY on screen (phone locked
    // on the channel), no visibility change fires — so re-check on the break itself.
    // Only pills currently in view do this, so a break never refetches every pill.
    const isInViewRef = useRef(isInView)
    isInViewRef.current = isInView
    useEffect(
        () =>
            subscribeConnectionEpoch(() => {
                if (isInViewRef.current) loadThreadDetails(call, threadID)
            }),
        [call, threadID],
    )

    const { members } = useChannelMembers(threadID, { autoFetch: false })
    const replyCount = useThreadReplyCount(threadID)

    // Undefined until the seed lands → keep the skeleton (members arrive in the same seed).
    if (replyCount === undefined) return <ThreadPillSkeleton />

    return <ThreadButton participants={members} messageCount={replyCount} threadID={threadID} channelID={channelID} />
}

/**
 * The "N replies" affordance under any thread-parent message (single or batch member).
 * Fetches the thread's members + reply count only once the message scrolls into view —
 * a channel full of threads doesn't fire a request per thread on load. Visibility stays
 * watched after that, so a count made suspect by a connection break refetches only when
 * the pill is actually on screen.
 * `channelID` = the message's channel (the thread's parent) — see ThreadButtonProps.
 */
export const MessageThreadPill = ({ threadID, channelID }: { threadID: string; channelID: string }) => {
    const { ref, isInView, hasBeenInView } = useInView()
    return <div ref={ref}>{hasBeenInView ? <LoadedThreadPill threadID={threadID} channelID={channelID} isInView={isInView} /> : <ThreadPillSkeleton />}</div>
}
