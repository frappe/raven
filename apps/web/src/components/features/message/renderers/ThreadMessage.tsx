import { useContext, useEffect } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import type { UserData } from "@db"
import { useSetAtom } from "jotai"
import { channelDrawerAtom, pollDrawerAtom } from "@utils/channelAtoms"
import { useCurrentChannelID } from "@hooks/useCurrentChannelID"
import { useChannelMembers } from "@hooks/useChannelMembers"
import { loadThreadDetails, useThreadReplyCount } from "@stores/threads/useThreadMeta"
import { useHasBeenInView } from "@hooks/useHasBeenInView"
import { NavLink, useLocation } from "react-router-dom"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

interface ThreadButtonProps {
    participants: UserData[]
    messageCount: number
    threadID?: string
}

export const ThreadButton = ({ participants, messageCount, threadID }: ThreadButtonProps) => {
    const location = useLocation()
    const channelID = useCurrentChannelID()
    const setDrawerType = useSetAtom(channelDrawerAtom(channelID))
    const setPollDrawer = useSetAtom(pollDrawerAtom(channelID))

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

    // TODO: Handle routing when this is clicked on the notifications/search page since we need to then go to the channel's thread route.
    // Thread route is sibling to the channel: strip any open `/thread/...` to get the
    // channel base, then point at this thread. `replace` so the back button still exits
    // the channel rather than cycling threads. Closing the channel drawer is a click
    // side-effect (navigating to a thread shouldn't leave the members/files drawer open).
    const to = `${location.pathname.split("/thread")[0]}/thread/${threadID}`

    return (
        <NavLink to={to} replace onClick={openThread} className={({ isActive }) => cn(className, isActive && "text-ink-gray-9")}>
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

const LoadedThreadPill = ({ threadID }: { threadID: string }) => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    // Mounted only once the parent message is in view. get_thread_details fires ONCE per
    // thread (gated in the store) and seeds both members and the reply count; realtime keeps
    // them live thereafter, so revisiting the channel doesn't refetch. Read both back through
    // their stores — members autoFetch off (the seed above covers it, no get_channel_members).
    useEffect(() => {
        loadThreadDetails(call, threadID)
    }, [call, threadID])

    const { members } = useChannelMembers(threadID, { autoFetch: false })
    const replyCount = useThreadReplyCount(threadID)

    // Undefined until the seed lands → keep the skeleton (members arrive in the same seed).
    if (replyCount === undefined) return <ThreadPillSkeleton />

    return <ThreadButton participants={members} messageCount={replyCount} threadID={threadID} />
}

/**
 * The "N replies" affordance under any thread-parent message (single or batch member).
 * Lazily fetches the thread's members + reply count only once the message scrolls into
 * view — a channel full of threads doesn't fire a request per thread on load.
 */
export const MessageThreadPill = ({ threadID }: { threadID: string }) => {
    const { ref, hasBeenInView } = useHasBeenInView()
    return <div ref={ref}>{hasBeenInView ? <LoadedThreadPill threadID={threadID} /> : <ThreadPillSkeleton />}</div>
}
