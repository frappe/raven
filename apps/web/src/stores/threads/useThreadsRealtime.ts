import { useContext } from "react"
import { FrappeConfig, FrappeContext, useFrappeEventListener, useSWRConfig } from "frappe-react-sdk"
import { useDebounceCallback } from "usehooks-ts"
import { reconcileUnknownThread, type ThreadCall } from "@stores/threads/listLoaders"
import { threadMetaStore } from "@stores/threads/store"
import { threadListStore } from "@stores/threads/listStore"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { useUserCookieData } from "@hooks/useUserCookieData"

/** Matches useUnreadRealtime's delete-reconcile debounce: batch deletes collapse
 *  into one refetch of the authoritative unread-thread list. */
const RECONCILE_DELAY = 1000

type ThreadReplyEvent = {
    /** The thread's channel id (a thread IS a Raven Channel). */
    channel_id: string
    number_of_replies: number
    sent_by: string
    /** Absent on DELETES — its presence is the "bump list ordering" signal
     *  (a delete updates the pill count but must not resurface the thread). */
    last_message_timestamp?: string
}

type UnreadThreadEvent = {
    channel_id: string
    sent_by: string
    last_message_timestamp: string
    /** Mirrors the channel unread event: "new_message" adds to the badge,
     *  "message_deleted" reconciles it. Absent from older servers → treated
     *  as a new reply (their delete path never fired this event's delete). */
    event_type?: "new_message" | "message_deleted"
}

/**
 * Keeps thread reply counts live. The `thread_reply` event fires whenever a message is
 * created in any thread and carries the new `number_of_replies`, so we patch the count
 * directly — no get_thread_details refetch.
 *
 * Patches ONLY threads already tracked in the store (a pill that's been viewed). Threads
 * the user hasn't opened are ignored here; their count is fetched fresh on first view, and
 * their unread state is handled separately (the sidebar badge — piece C).
 *
 * Mounted once at the shell.
 */
export const useThreadsRealtime = () => {
    const { name } = useUserCookieData()
    const currentUser = name

    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as ThreadCall

    // Broadcast to everyone — keeps the "N replies" pill live for all channel members.
    useFrappeEventListener("thread_reply", (event: ThreadReplyEvent) => {
        if (!event?.channel_id) return
        // Count → threadMetaStore (the list + pill read it there); order → list windows.
        threadMetaStore.patch(event.channel_id, event.number_of_replies, event.last_message_timestamp)
        // DELETES reuse this event for the pill count but omit the timestamp:
        // no ordering bump, and nothing new to surface in list views.
        if (!event.last_message_timestamp) return
        threadListStore.bump(event.channel_id, event.last_message_timestamp)
        // bump only reorders rows a view already has. If a loaded view is missing
        // this thread (it's brand new — often the user's OWN new thread, which the
        // unread backstop never sees), refetch that view's page 0 so the row shows
        // up. Each (view, thread) pair is only tried once, so a busy thread that
        // doesn't belong in a view can't keep triggering fetches.
        reconcileUnknownThread(client, event.channel_id)
    })

    // Scoped to the thread's participants — the unread-threads badge, branching on
    // event_type exactly like the channel handler (useUnreadRealtime): a new reply
    // ADDS the thread; a delete RECONCILES against the server — the deleted reply's
    // read-state is unknowable locally, so no local decrement. The delete path runs
    // before the own-message skip: sent_by is the deleted message's owner, and
    // someone else deleting it must still heal our badge.
    const { mutate } = useSWRConfig()
    const reconcileUnreadThreads = useDebounceCallback(() => mutate("unread_threads"), RECONCILE_DELAY)
    useFrappeEventListener("raven:unread_thread_count_updated", (event: UnreadThreadEvent) => {
        if (!event?.channel_id) return
        if (event.event_type === "message_deleted") {
            // Only worth a refetch when this thread currently shows unread here.
            if (unreadThreadsStore.getSnapshot().has(event.channel_id)) {
                reconcileUnreadThreads()
            }
            return
        }
        // Skip our own replies; the store skips the thread the user is actively
        // reading, and reading a thread clears it (useChannelReadTracker).
        if (event.sent_by === currentUser) return
        unreadThreadsStore.add(event.channel_id)
    })
}
