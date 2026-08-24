import { liveQuery } from "dexie"
import { db, type UserData } from "@db"

type Listener = () => void

/** Shallow-equal over UserData's fields (name is the key, equal by construction). */
const sameUser = (a: UserData, b: UserData): boolean =>
    a.full_name === b.full_name &&
    a.user_image === b.user_image &&
    a.first_name === b.first_name &&
    a.enabled === b.enabled &&
    a.type === b.type &&
    a.availability_status === b.availability_status &&
    a.custom_status === b.custom_status

/**
 * Singleton users lookup — ONE Dexie observable maintaining ONE immutable Map
 * snapshot shared by reference across every consumer (via useSyncExternalStore).
 * Replaces per-consumer liveQueries, which each ran a full-table IndexedDB read
 * on every users write.
 *
 * Two subscription granularities:
 *   - subscribe / getSnapshot : the whole Map (bulk lookups, useUsersById)
 *   - subscribeUser / getUser : a single user (useUser) — only that user's
 *     watchers wake when it changes
 *
 * Crucially, on each table write we DIFF against the previous snapshot and REUSE
 * the prior object reference for any user whose fields are unchanged. So a single
 * profile edit keeps every other user's identity stable (memo'd avatars don't
 * re-render) and only notifies the listeners watching the user(s) that actually
 * changed. A write that doesn't touch any UserData field is a no-op.
 *
 * The subscription starts on first use and lives for the app's lifetime.
 */
class UsersStore {
    private snapshot: Map<string, UserData> = new Map()
    private listeners = new Set<Listener>()
    private userListeners = new Map<string, Set<Listener>>()
    private started = false

    private start() {
        if (this.started) return
        this.started = true
        liveQuery(() => db.users.toArray()).subscribe({
            next: (users) => this.applyUsers(users),
            error: (error) => console.error("users liveQuery failed", error),
        })
    }

    private applyUsers(users: UserData[]) {
        const prev = this.snapshot
        const next = new Map<string, UserData>()
        const changed: string[] = []

        for (const user of users) {
            const existing = prev.get(user.name)
            if (existing && sameUser(existing, user)) {
                next.set(user.name, existing) // reuse stable reference
            } else {
                next.set(user.name, user)
                changed.push(user.name)
            }
        }
        for (const name of prev.keys()) {
            if (!next.has(name)) changed.push(name) // removed
        }

        if (changed.length === 0 && next.size === prev.size) return // nothing relevant changed

        this.snapshot = next
        for (const name of changed) this.userListeners.get(name)?.forEach((listener) => listener())
        this.listeners.forEach((listener) => listener())
    }

    /** ----- Whole-map (bulk lookups) ----- */

    subscribe = (listener: Listener) => {
        this.start()
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    /** Stable reference between relevant table writes — required by useSyncExternalStore. */
    getSnapshot = () => this.snapshot

    /** ----- Single user ----- */

    subscribeUser = (userID: string, listener: Listener) => {
        this.start()
        let set = this.userListeners.get(userID)
        if (!set) {
            set = new Set()
            this.userListeners.set(userID, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.userListeners.delete(userID)
        }
    }

    /** Reference-stable per user between changes to THAT user. */
    getUser = (userID: string): UserData | undefined => this.snapshot.get(userID)
}

export const usersStore = new UsersStore()
