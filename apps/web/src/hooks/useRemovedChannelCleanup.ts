import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useSetAtom } from "jotai"
import { toast } from "sonner"
import { channelMessagesStore } from "@stores/messages/store"
import { useChannels } from "@stores/channels/useChannelList"
import { lastChannelAtom } from "@utils/lastVisitedAtoms"
import _ from "@lib/translate"

/**
 * Removals the user made THEMSELVES (they deleted the channel and already got
 * their own confirmation toast). The delete flow registers the id before it
 * patches the list; the reconciler still runs its cleanup for it but stays
 * quiet — "this channel is no longer available" is for bystanders, not the
 * actor.
 */
const expectedRemovals = new Set<string>()
export const markChannelRemovalExpected = (channelID: string) => {
	expectedRemovals.add(channelID)
}

/**
 * Cleans up after channels that DISAPPEAR from the channel list — deleted by
 * someone, or this user lost access. The server only says "the list changed"
 * (channel_list_updated carries no deleted/updated distinction), so removal is
 * detected here by diffing each new list against the previous one.
 *
 * For each removed channel:
 *  - its message state is dropped from the store (which also makes the
 *    room-subscription hook doc_unsubscribe its socket room), so a deleted
 *    channel doesn't sit warm in memory until LRU eviction
 *  - lastChannelAtom is cleared if it pointed at it — otherwise the desktop
 *    home redirect would bounce the next visit straight into the dead route
 *  - if the user is LOOKING at it (channel page or a thread under it), they
 *    are sent to the workspace list with a toast, instead of being left on a
 *    ghost page whose channel no longer resolves
 *
 * Mounted once at the app shell.
 */
export const useRemovedChannelCleanup = () => {
    const { channels, isLoading } = useChannels()
    const navigate = useNavigate()
    const location = useLocation()
    const setLastChannel = useSetAtom(lastChannelAtom)

    // The effect below keys on the channel list ONLY. Everything else it needs
    // is read through refs at diff time — the current route must be whatever
    // is on screen when the removal is detected, not whatever it was when the
    // list last changed.
    const pathnameRef = useRef(location.pathname)
    pathnameRef.current = location.pathname

    const previousRef = useRef<Set<string> | null>(null)

    useEffect(() => {
        if (isLoading) return
        const current = new Set(channels.map((channel) => channel.name))
        const previous = previousRef.current
        previousRef.current = current
        if (!previous) return
        // An empty list right after a non-empty one is treated as suspect (a
        // bad refetch would look exactly like this) — skip the diff rather
        // than tear down every channel's state on a glitch.
        if (current.size === 0) return

        const removed = [...previous].filter((id) => !current.has(id))
        if (removed.length === 0) return

        for (const id of removed) {
            channelMessagesStore.remove(id)
        }

        // A stale "last visited" pointing at a removed channel would send the
        // next home redirect into the dead route (WorkspaceRedirect also
        // validates now — this keeps the stored value honest anyway).
        setLastChannel((last) => (removed.includes(last) ? "" : last))

        // Channel routes are /:workspaceID/:channelID(/thread/…) — the second
        // segment is the channel wherever one is on screen.
        const segments = pathnameRef.current.split("/").filter(Boolean).map(decodeURIComponent)
        if (segments[1] && removed.includes(segments[1])) {
            if (!expectedRemovals.has(segments[1])) {
                toast(_("This channel is no longer available"))
            }
            navigate(`/${encodeURIComponent(segments[0])}`, { replace: true })
        }

        // Consume the expectations that just resolved — a FUTURE removal of a
        // recreated channel with the same id must toast again.
        for (const id of removed) expectedRemovals.delete(id)
    }, [channels, isLoading, navigate, setLastChannel])
}
