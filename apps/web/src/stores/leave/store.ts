type Listener = () => void

/**
 * A set of users that holds for TODAY (on leave, working from home), keyed per user.
 *
 * Per-user subscriptions like presenceStore, so a change re-renders only the badges
 * watching that user. A daily HR fact has no realtime event: setUsers() from
 * get_users_hr_day_status (useLeaveSync) is its only input.
 */
export class DailyUserSetStore {
    private users = new Set<string>()
    private listeners = new Map<string, Set<Listener>>()

    /** Primitive snapshot, safe to read per render. */
    has(userID: string): boolean {
        return this.users.has(userID)
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

    /** Replace the set with the authoritative list; notify only users who flipped. */
    setUsers(userIDs: string[]) {
        const next = new Set(userIDs)
        const changed: string[] = []
        for (const userID of next) if (!this.users.has(userID)) changed.push(userID)
        for (const userID of this.users) if (!next.has(userID)) changed.push(userID)
        if (changed.length === 0) return
        this.users = next
        for (const userID of changed) this.notify(userID)
    }

    private notify(userID: string) {
        this.listeners.get(userID)?.forEach((listener) => listener())
    }
}

export const leaveStore = new DailyUserSetStore()
export const wfhStore = new DailyUserSetStore()
