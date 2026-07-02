type Listener = () => void

/**
 * The set of threads that currently have unread messages FOR THIS USER — the source of the
 * sidebar threads badge (a conversation count, like the channel/DM badges, not a message sum).
 *
 * Unlike the channel unread store there are no per-thread counts here: the badge only needs
 * "how many threads are unread", so a Set of thread ids is enough and the whole store has a
 * single subscription.
 *
 * Kept live entirely client-side: the participant-scoped `raven:unread_thread_count_updated`
 * event adds a thread, reading a thread removes it, and `get_unread_threads` reconciles the
 * set on mount / focus / reconnect as a backstop for anything missed while disconnected.
 */
class UnreadThreadsStore {
    private unread = new Set<string>()
    private listeners = new Set<Listener>()
    /** The thread the user is currently caught up on — events for it don't mark it unread. */
    private activeThreadID: string | null = null
    /**
     * Reference-stable immutable view of the unread set, rebuilt (new reference) ONLY when
     * membership changes — see notify(). This is the useSyncExternalStore snapshot: returning
     * the same reference between changes is required (a fresh Set every call would loop), and
     * a new reference on every membership change (including same-size swaps) is what makes
     * consumers re-render. Size alone is not a safe signal — swapping one unread thread for
     * another keeps size at 1 — so membership consumers (the dot) read this, not getCount.
     */
    private cachedSnapshot: ReadonlySet<string> = new Set()

    /** Number of threads with unread messages — primitive snapshot, safe per render. */
    getCount(): number {
        return this.unread.size
    }

    /** Reference-stable unread-id set for useSyncExternalStore; new ref only on change. */
    getSnapshot(): ReadonlySet<string> {
        return this.cachedSnapshot
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    /** Mark a thread unread (from the realtime event). No-op for the actively-read thread. */
    add(threadID: string) {
        if (!threadID || threadID === this.activeThreadID || this.unread.has(threadID)) return
        this.unread.add(threadID)
        this.notify()
    }

    /** Clear a thread's unread (the user read it). No-op if it wasn't unread. */
    remove(threadID: string) {
        if (!this.unread.delete(threadID)) return
        this.notify()
    }

    /** Replace the set with the server's authoritative list (get_unread_threads). */
    reconcile(threadIDs: string[]) {
        const next = new Set(threadIDs)
        // The actively-read thread is read locally even if the server hasn't recorded the
        // visit yet — don't let a reconcile resurrect its badge.
        if (this.activeThreadID) next.delete(this.activeThreadID)
        if (next.size === this.unread.size && [...next].every((id) => this.unread.has(id))) return
        this.unread = next
        this.notify()
    }

    /** The read tracker registers the caught-up thread here (and clears it on leave). */
    setActiveThread(threadID: string | null) {
        if (this.activeThreadID === threadID) return
        this.activeThreadID = threadID
        if (threadID) this.remove(threadID)
    }

    private notify() {
        // Rebuild the stable snapshot BEFORE notifying so consumers read the new membership.
        this.cachedSnapshot = new Set(this.unread)
        this.listeners.forEach((listener) => listener())
    }
}

export const unreadThreadsStore = new UnreadThreadsStore()
