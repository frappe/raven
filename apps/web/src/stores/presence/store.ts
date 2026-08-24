type Listener = () => void

/**
 * Tracks which users are currently online (connected/active), keyed per user.
 *
 * Read by every avatar, mention, and member row, so it's a per-user-subscription
 * store rather than one shared array (v2 kept `active_users` in SWR, which
 * re-rendered every consumer on any presence change). Here a user going on/offline
 * notifies only the components watching THAT user.
 *
 * Two inputs:
 *   - setActiveUsers(): the authoritative list from get_active_users (initial load
 *     and reconnect reseed)
 *   - setUserActive(): a single realtime raven:user_active_state_updated event
 */
class PresenceStore {
    private online = new Set<string>()
    private listeners = new Map<string, Set<Listener>>()

    /** Current online state for a user — primitive snapshot, safe to read per render. */
    isOnline(userID: string): boolean {
        return this.online.has(userID)
    }

    subscribe(userID: string, listener: Listener): () => void {
        let set = this.listeners.get(userID)
        if (!set) {
            set = new Set()
            this.listeners.set(userID, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.listeners.delete(userID)
        }
    }

    /** Replace the online set with the authoritative list; notify only users who flipped. */
    setActiveUsers(userIDs: string[]) {
        const next = new Set(userIDs)
        const changed: string[] = []
        for (const userID of next) if (!this.online.has(userID)) changed.push(userID)
        for (const userID of this.online) if (!next.has(userID)) changed.push(userID)
        if (changed.length === 0) return
        this.online = next
        for (const userID of changed) this.notify(userID)
    }

    /** Apply a single realtime presence change. */
    setUserActive(userID: string, active: boolean) {
        if (this.online.has(userID) === active) return
        if (active) this.online.add(userID)
        else this.online.delete(userID)
        this.notify(userID)
    }

    private notify(userID: string) {
        this.listeners.get(userID)?.forEach((listener) => listener())
    }
}

export const presenceStore = new PresenceStore()
