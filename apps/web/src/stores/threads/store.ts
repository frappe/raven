import { getConnectionEpoch } from "@stores/connectionFreshness"

type Listener = () => void

type Entry = {
    /** Live reply count for the thread (get_thread_details.message_count, then patched by thread_reply). */
    replyCount: number
    /** Timestamp of the latest reply — kept for the threads list / unread badge (piece C). */
    lastMessageTimestamp?: string
    /** Connection-break counter (stores/connectionFreshness) when this entry was last
     *  fetched or patched. A live `thread_reply` patch proves the connection was alive
     *  at that moment, so it counts as validation too. If this falls behind the current
     *  counter, a break happened since — the count might have missed an event. */
    epoch: number
    /** When the last realtime patch landed (ms). Lets a refetch tell whether a patch
     *  arrived while its request was in flight — the patch is the newer truth then. */
    patchedAt?: number
}

/**
 * Per-thread metadata that changes FREQUENTLY — currently just the reply count.
 *
 * Deliberately separate from `channelMembersStore`: a thread's members change rarely
 * (refetched on `channel_members_updated`), but replies stream in. The `thread_reply`
 * event already carries `number_of_replies`, so a new reply patches the count straight
 * from the event — no refetch, and no conflating the hot count with the cold member map
 * in one cache entry.
 *
 * LAZY + patch-only-loaded: an entry exists only once a pill has been viewed and seeded
 * it from get_thread_details. `thread_reply` for a never-opened thread is a no-op here
 * (it still feeds the unread badge separately); the count is fetched fresh when that
 * thread is finally viewed.
 */
class ThreadMetaStore {
    private entries = new Map<string, Entry>()
    private listeners = new Map<string, Set<Listener>>()

    /** Current reply count, or undefined if this thread hasn't been seeded yet. */
    getCount(threadID: string): number | undefined {
        return this.entries.get(threadID)?.replyCount
    }

    /** True when the count can't be trusted: never fetched, or the realtime connection
     *  has broken since it was last fetched/patched (a `thread_reply` event may have
     *  been missed during the gap). Stale counts get refetched — see loadThreadDetails. */
    isStale(threadID: string): boolean {
        const entry = this.entries.get(threadID)
        return !entry || entry.epoch < getConnectionEpoch()
    }

    subscribe(threadID: string, listener: Listener): () => void {
        let set = this.listeners.get(threadID)
        if (!set) {
            set = new Set()
            this.listeners.set(threadID, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.listeners.delete(threadID)
        }
    }

    /**
     * One-time seed (create-thread starts at 0, list rows carry a count). Won't clobber
     * an entry that's already tracked — a live `thread_reply` patch is newer than a
     * fetch that may have been in flight when the reply arrived.
     */
    seed(threadID: string, replyCount: number, lastMessageTimestamp?: string) {
        if (this.entries.has(threadID)) return
        this.entries.set(threadID, { replyCount, lastMessageTimestamp, epoch: getConnectionEpoch() })
        this.notify(threadID)
    }

    /**
     * Apply a get_thread_details response — the initial fetch, or a refetch after a
     * connection break. Overwrites the entry, EXCEPT when a realtime patch landed while
     * the request was in flight: the patch is newer truth, so only the response's count
     * is discarded (the entry was already re-stamped by the patch).
     *
     * `epochAtFetchStart` = the break counter read before the request went out; if the
     * connection broke mid-request, the entry stays stale and gets refetched again.
     */
    applyFetched(threadID: string, replyCount: number, epochAtFetchStart: number, fetchStartedAt: number) {
        const prev = this.entries.get(threadID)
        if (prev?.patchedAt && prev.patchedAt >= fetchStartedAt) return
        if (prev?.replyCount === replyCount && prev.epoch === epochAtFetchStart) return
        this.entries.set(threadID, {
            replyCount,
            lastMessageTimestamp: prev?.lastMessageTimestamp,
            epoch: epochAtFetchStart,
        })
        this.notify(threadID)
    }

    /**
     * Apply a `thread_reply` event. Patches ONLY threads already tracked here — we never
     * build state for threads the user hasn't opened (those are handled by the unread badge).
     */
    patch(threadID: string, replyCount: number, lastMessageTimestamp?: string) {
        const prev = this.entries.get(threadID)
        if (!prev) return
        // Receiving an event proves the connection is alive right now — re-stamp, so an
        // active thread never looks suspect. (Even when the count itself is unchanged.)
        const entry: Entry = {
            replyCount,
            lastMessageTimestamp: lastMessageTimestamp ?? prev.lastMessageTimestamp,
            epoch: getConnectionEpoch(),
            patchedAt: Date.now(),
        }
        const countChanged = prev.replyCount !== replyCount || prev.lastMessageTimestamp !== entry.lastMessageTimestamp
        this.entries.set(threadID, entry)
        if (countChanged) this.notify(threadID)
    }

    private notify(threadID: string) {
        this.listeners.get(threadID)?.forEach((listener) => listener())
    }
}

export const threadMetaStore = new ThreadMetaStore()
