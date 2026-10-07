type Listener = () => void

/** Per-member metadata from get_channel_members / get_thread_details (same shape). */
export type MemberMeta = { is_admin: 0 | 1; channel_member_name: string | null }

type Status = "idle" | "loading" | "loaded" | "error"

type Entry = {
    /** userId → meta. Ref-stable: replaced only when the membership set actually changes. */
    members: Record<string, MemberMeta>
    status: Status
}

/** Shared stable reference for unloaded channels — keeps getSnapshot identity stable. */
const IDLE: Entry = { members: {}, status: "idle" }

const sameMembers = (a: Record<string, MemberMeta>, b: Record<string, MemberMeta>) => {
    const ids = Object.keys(a)
    if (ids.length !== Object.keys(b).length) return false
    return ids.every((id) => b[id] && b[id].is_admin === a[id].is_admin && b[id].channel_member_name === a[id].channel_member_name)
}

/**
 * Per-channel member lists (a thread is a Raven Channel too, so the same store keys
 * threads by their id — no channel/thread distinction). Lazy: an entry only exists once
 * something loads it (a member drawer opens, a page of messages or threads carries it).
 * Realtime (`channel_members_updated`, common to channels + threads) refetches ONLY
 * already-loaded entries, so we never build member lists for threads the user hasn't loaded.
 *
 * Holds the raw meta map (is_admin / channel_member_name); the hook resolves ids →
 * UserData via usersStore. Replaces the per-consumer SWR + per-render rebuild in the
 * old useChannelMembers.
 */
class ChannelMembersStore {
    private entries = new Map<string, Entry>()
    private listeners = new Map<string, Set<Listener>>()

    getEntry(channelID: string): Entry {
        return this.entries.get(channelID) ?? IDLE
    }

    /** True once a real fetch has populated this channel (so realtime knows to refetch it). */
    isLoaded(channelID: string): boolean {
        return this.entries.get(channelID)?.status === "loaded"
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

    setStatus(channelID: string, status: Status) {
        const prev = this.getEntry(channelID)
        if (prev.status === status) return
        this.entries.set(channelID, { members: prev.members, status })
        this.notify(channelID)
    }

    /** Replace a channel's members (from get_channel_members / get_thread_details). */
    setMembers(channelID: string, members: Record<string, MemberMeta>) {
        const prev = this.entries.get(channelID)
        // Every page that shows a thread re-sends its members; unchanged ones keep their object.
        if (prev && sameMembers(prev.members, members)) {
            this.setStatus(channelID, "loaded")
            return
        }
        this.entries.set(channelID, { members, status: "loaded" })
        this.notify(channelID)
    }

    /**
     * Insert or update one member without a fetch.
     *
     * Why it exists: when the user joins a channel or thread, the join
     * response already proves they are a member. Writing that in directly
     * flips the join banner immediately — no refetch to wait on, and no way
     * for a slow or stale refetch to leave the banner stuck. Marks the entry
     * loaded even from idle: one confirmed member is better than nothing.
     */
    upsertMember(channelID: string, userID: string, meta: MemberMeta) {
        const prev = this.getEntry(channelID)
        const existing = prev.members[userID]
        if (
            existing &&
            existing.is_admin === meta.is_admin &&
            existing.channel_member_name === meta.channel_member_name
        ) {
            return
        }
        this.entries.set(channelID, {
            members: { ...prev.members, [userID]: meta },
            status: "loaded",
        })
        this.notify(channelID)
    }

    private notify(channelID: string) {
        this.listeners.get(channelID)?.forEach((listener) => listener())
    }
}

export const channelMembersStore = new ChannelMembersStore()
