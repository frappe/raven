import { useCallback, useSyncExternalStore } from "react"
import type { FrappeConfig } from "frappe-react-sdk"
import { threadMetaStore } from "@stores/threads/store"
import { getConnectionEpoch } from "@stores/connectionFreshness"
import { applyThreadDetails, type ThreadDetails } from "@stores/threads/details"

type Caller = FrappeConfig["call"]

/** Threads with a get_thread_details fetch in flight — dedupes concurrent pills / remounts. */
const inFlight = new Set<string>()

/**
 * Fetch get_thread_details and seed both stores it feeds — members (kept live
 * thereafter by `channel_members_updated`) and the reply count (kept live by
 * `thread_reply`). Normally fires ONCE per thread: it no-ops when the count is
 * already tracked, so revisiting a channel doesn't refetch every pill.
 *
 * The exception is a connection break (phone locked, socket dropped — see
 * stores/connectionFreshness): a `thread_reply` event may have been missed during
 * the gap, so a tracked-but-suspect count is refetched. Safe to call eagerly —
 * it still costs nothing while the connection has been stable.
 */
export const loadThreadDetails = (call: Caller, threadID: string) => {
    if (!threadID) return
    if (!threadMetaStore.isStale(threadID) || inFlight.has(threadID)) return
    inFlight.add(threadID)
    // Read the break counter and clock BEFORE fetching, so the store can tell whether
    // the connection broke — or a newer realtime patch landed — while this was in flight.
    const epochAtStart = getConnectionEpoch()
    const startedAt = Date.now()
    call
        .get<{ message: ThreadDetails }>("raven.api.threads.get_thread_details", { thread_id: threadID })
        .then((res) => applyThreadDetails(threadID, res.message, epochAtStart, startedAt))
        .finally(() => inFlight.delete(threadID))
}

/**
 * Live reply count for a thread, store-backed. Returns undefined until the thread has been
 * seeded — callers fall back to the value from their own get_thread_details fetch.
 */
export const useThreadReplyCount = (threadID: string): number | undefined => {
    return useSyncExternalStore(
        useCallback((onChange) => threadMetaStore.subscribe(threadID, onChange), [threadID]),
        () => threadMetaStore.getCount(threadID),
    )
}
