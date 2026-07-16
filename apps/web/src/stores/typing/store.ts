type Listener = () => void

const EMPTY: readonly string[] = []

/**
 * Who's typing, per channel — ephemeral realtime state (like presence, but
 * channel-scoped). The realtime server sends the FULL typers list per event,
 * so this is a replace-only store.
 *
 * Per-channel subscriptions: a typing burst in one channel never re-renders
 * another channel's indicator. Snapshots are reference-stable (same array
 * until the list actually changes, shared EMPTY when nobody is typing), as
 * useSyncExternalStore requires.
 */
class TypingStore {
    private typers = new Map<string, readonly string[]>()
    private listeners = new Map<string, Set<Listener>>()

    getTypers(channelID: string): readonly string[] {
        return this.typers.get(channelID) ?? EMPTY
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

    /** Replace a channel's typers (the server list is authoritative); no-op when unchanged. */
    setTypers(channelID: string, users: string[]) {
        const prev = this.getTypers(channelID)
        if (prev.length === users.length && prev.every((user, i) => user === users[i])) return
        if (users.length === 0) this.typers.delete(channelID)
        else this.typers.set(channelID, users)
        this.listeners.get(channelID)?.forEach((listener) => listener())
    }
}

export const typingStore = new TypingStore()
