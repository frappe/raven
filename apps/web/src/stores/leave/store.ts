type Listener = () => void

/**
 * Tracks which users are on leave TODAY, keyed per user.
 *
 * Mirrors presenceStore (per-user subscriptions so a leave change re-renders only
 * the avatars/badges watching THAT user), but simpler: leave is a daily fact with
 * no realtime event, so there's a single authoritative input — setUsersOnLeave()
 * from get_all_users_on_leave (seeded by useLeaveSync, re-fetched on reconnect).
 */
class LeaveStore {
    private onLeave = new Set<string>()
    private listeners = new Map<string, Set<Listener>>()

    /** Whether a user is on leave today — primitive snapshot, safe to read per render. */
    isOnLeave(userID: string): boolean {
        return this.onLeave.has(userID)
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

    /** Replace the on-leave set with the authoritative list; notify only users who flipped. */
    setUsersOnLeave(userIDs: string[]) {
        const next = new Set(userIDs)
        const changed: string[] = []
        for (const userID of next) if (!this.onLeave.has(userID)) changed.push(userID)
        for (const userID of this.onLeave) if (!next.has(userID)) changed.push(userID)
        if (changed.length === 0) return
        this.onLeave = next
        for (const userID of changed) this.notify(userID)
    }

    private notify(userID: string) {
        this.listeners.get(userID)?.forEach((listener) => listener())
    }
}

export const leaveStore = new LeaveStore()
