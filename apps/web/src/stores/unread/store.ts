type Listener = () => void

export type ChannelUnreadState = {
    /** Unread message count — messages created after the read watermark (last_visit). */
    count: number
    /**
     * Read watermark: the timestamp this channel is marked read up to (mirrors the
     * member's server-side last_visit). Forward-only. Null until the channel has
     * been reconciled or marked read at least once this session — while null,
     * increments are always accepted (we have no basis to call them stale).
     */
    lastSeen: string | null
}

/** Shared reference for "no unread" so unsubscribed/unknown channels stay reference-stable. */
const EMPTY_STATE: ChannelUnreadState = Object.freeze({ count: 0, lastSeen: null })

/**
 * Chronological compare of backend datetimes. Frappe emits a fixed-width
 * `YYYY-MM-DD HH:MM:SS.ffffff`, so lexicographic order == chronological order —
 * no Date/dayjs parse needed (same approach the message reducer takes).
 */
const isAfter = (a: string, b: string | null): boolean => b === null || a > b

/**
 * The single writer for per-channel unread state.
 *
 * Three inputs feed it, and the ordering between them is what kept v2 racy:
 *   - reconcile()  : the authoritative server count (on load / focus / drift)
 *   - increment()  : a realtime "new message" signal (no count in the payload)
 *   - markRead()   : the local read watermark flushing as the user scrolls
 *
 * They're reconciled here with two guards so they can arrive in any order:
 *   - a timestamp guard drops increments at/below a channel's watermark
 *     (an out-of-order or duplicate signal can't re-raise a read count)
 *   - the active live-edge channel is exempt from increments entirely — the
 *     channel you're reading is read, and its watermark flush owns its count.
 */
class ChannelUnreadStore {
    private states = new Map<string, ChannelUnreadState>()
    private listeners = new Map<string, Set<Listener>>()
    /** Subscribers to the aggregate (total unread) — notified on any channel change. */
    private globalListeners = new Set<Listener>()
    /** The channel currently open AND caught up to the live edge; exempt from increments. */
    private activeReadChannelID: string | null = null
    /** Per-channel server last_visit at load — the read tracker's post baseline (see setServerWatermark). */
    private serverWatermarks = new Map<string, string>()

    /** Reference-stable per channel: unchanged state returns the same object (and unknown → EMPTY). */
    getState(channelID: string): ChannelUnreadState {
        return this.states.get(channelID) ?? EMPTY_STATE
    }

    subscribe(channelID: string, listener: Listener): () => void {
        let set = this.listeners.get(channelID)
        if (!set) {
            set = new Set()
            this.listeners.set(channelID, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.listeners.delete(channelID)
        }
    }

    subscribeGlobal(listener: Listener): () => void {
        this.globalListeners.add(listener)
        return () => this.globalListeners.delete(listener)
    }

    // NOTE: no raw "total unread" getter on purpose — this store doesn't know which
    // channels are MUTED, and every app-level aggregate (tab title, icon badge,
    // footer) must exclude them. Compose totals in the hooks layer
    // (useChannelUnread.ts), which joins against the channel list.

    /** Ids of the currently-unread channels (notification-shade housekeeping). */
    getUnreadChannelIDs(): string[] {
        const ids: string[] = []
        for (const [channelID, state] of this.states) if (state.count > 0) ids.push(channelID)
        return ids
    }

    /** ----- Inputs ----- */

    /**
     * Apply authoritative server counts. `counts` is the full set of channels the
     * server reports as unread; any channel we're tracking that's NOT in the set is
     * zeroed (it was read elsewhere). Watermarks are preserved.
     */
    reconcile(counts: Map<string, number>) {
        for (const [channelID, count] of counts) {
            this.setCount(channelID, count)
        }
        for (const [channelID, state] of this.states) {
            if (state.count > 0 && !counts.has(channelID)) this.setCount(channelID, 0)
        }
    }

    /**
     * A realtime new-message signal for a channel. The payload carries no count,
     * so we bump by one — unless this is the channel being actively read, or the
     * message is at/below our watermark (stale / already counted).
     */
    increment(channelID: string, messageTimestamp?: string) {
        if (channelID === this.activeReadChannelID) return
        const state = this.getState(channelID)
        if (messageTimestamp && !isAfter(messageTimestamp, state.lastSeen)) return
        this.update(channelID, { count: state.count + 1, lastSeen: state.lastSeen })
    }

    /**
     * Mark a channel read up to `timestamp` (the newest message the user has seen).
     * Forward-only. `caughtUp` means the user reached the live edge, so the count
     * is zeroed; on a partial read we only advance the watermark and leave the
     * count for the next reconcile to recompute authoritatively.
     */
    markRead(channelID: string, timestamp: string, caughtUp: boolean) {
        const state = this.getState(channelID)
        if (!isAfter(timestamp, state.lastSeen)) {
            if (caughtUp && state.count !== 0) this.update(channelID, { count: 0, lastSeen: state.lastSeen })
            return
        }
        this.update(channelID, { count: caughtUp ? 0 : state.count, lastSeen: timestamp })
    }

    /**
     * Mark a channel unread back to `watermark` with a server-computed `count`.
     * The deliberate BACKWARD counterpart to markRead (which is forward-only and
     * would drop this): the user marked a channel/message unread, rolling
     * last_visit backward server-side, so we set lastSeen backward and the count
     * directly. Mirrors set_channel_unread's guard bypass on the backend.
     */
    markUnread(channelID: string, watermark: string, count: number) {
        this.update(channelID, { count, lastSeen: watermark })
        // Roll the PRISTINE server baseline back too — the server's last_visit
        // just moved backward, and the read tracker seeds its "don't re-post"
        // guard from this map. Left at the old (higher) value, re-reading the
        // channel would post nothing (watermark <= baseline → skip), the server
        // would keep it unread, and the badge would come back on refresh. Only
        // a fresh get_messages response would otherwise overwrite it — which a
        // warm re-entry never triggers.
        this.serverWatermarks.set(channelID, watermark)
    }

    /** Register the channel open at the live edge (or null). It won't accumulate increments. */
    setActiveReadChannel(channelID: string | null) {
        this.activeReadChannelID = channelID
    }

    /**
     * The member's server-side last_visit at channel load — a PRISTINE baseline kept apart
     * from `lastSeen` (which advances on local reads). The read tracker seeds `sentRef` from
     * this so it won't re-post a watermark the server already has. Not reactive (no UI reads it).
     */
    setServerWatermark(channelID: string, timestamp?: string | null) {
        if (timestamp) this.serverWatermarks.set(channelID, timestamp)
    }

    getServerWatermark(channelID: string): string | null {
        return this.serverWatermarks.get(channelID) ?? null
    }

    /** ----- Internals ----- */

    private setCount(channelID: string, count: number) {
        const state = this.getState(channelID)
        // The channel being actively read is authoritative-zero locally — a
        // reconcile computed just before our read committed must not re-raise it.
        const target = channelID === this.activeReadChannelID ? 0 : count
        if (state.count === target) return
        this.update(channelID, { count: target, lastSeen: state.lastSeen })
    }

    private update(channelID: string, next: ChannelUnreadState) {
        const current = this.getState(channelID)
        if (current.count === next.count && current.lastSeen === next.lastSeen) return
        if (next.count === 0 && next.lastSeen === null) this.states.delete(channelID)
        else this.states.set(channelID, next)
        this.listeners.get(channelID)?.forEach((listener) => listener())
        this.globalListeners.forEach((listener) => listener())
    }
}

export const channelUnreadStore = new ChannelUnreadStore()
