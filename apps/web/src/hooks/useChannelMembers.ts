import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { UserData } from "@db"
import { channelMembersStore, type MemberMeta } from "@stores/members/store"
import { useUsersById } from "@hooks/useMessageRowLookups"

export type ChannelMemberData = UserData & { is_admin?: 0 | 1; channel_member_name?: string | null }

type Caller = FrappeConfig["call"]

/**
 * Fetch + seed a channel's (or thread's) members into the store. Idempotent: a no-op
 * unless the entry is idle or `force` (used by realtime / add-remove to refresh).
 */
export const loadChannelMembers = (call: Caller, channelID: string, force = false) => {
    if (!channelID) return
    if (!force && channelMembersStore.getEntry(channelID).status !== "idle") return
    channelMembersStore.setStatus(channelID, "loading")
    call
        .get<{ message: Record<string, MemberMeta> }>("raven.api.raven_channel_member.get_channel_members", {
            channel_id: channelID,
        })
        .then((res) => channelMembersStore.setMembers(channelID, res.message ?? {}))
        .catch(() => channelMembersStore.setStatus(channelID, "error"))
}

/** Refetch a channel's members ONLY if it's already loaded — for `channel_members_updated`. */
export const refetchChannelMembersIfLoaded = (call: Caller, channelID: string) => {
    if (channelMembersStore.isLoaded(channelID)) loadChannelMembers(call, channelID, true)
}

/** Seed members directly without a fetch — e.g. from get_thread_details (same shape). */
export const seedChannelMembers = (channelID: string, members: Record<string, MemberMeta>) => {
    channelMembersStore.setMembers(channelID, members)
}

/**
 * A channel's (or thread's) members, store-backed. Triggers the lazy fetch on mount,
 * resolves member ids → UserData via usersStore, and returns the same shape the old
 * SWR hook did so consumers are unchanged. `mutate` forces a refetch.
 */
export const useChannelMembers = (channelID: string, options?: { autoFetch?: boolean }) => {
    // autoFetch=false: read the store but don't trigger get_channel_members — for callers
    // that seed it another way (the thread pill seeds from get_thread_details).
    const autoFetch = options?.autoFetch ?? true
    const { call } = useContext(FrappeContext) as FrappeConfig
    const entry = useSyncExternalStore(
        useCallback((onChange) => channelMembersStore.subscribe(channelID, onChange), [channelID]),
        () => channelMembersStore.getEntry(channelID),
    )
    const usersById = useUsersById()

    useEffect(() => {
        if (autoFetch) loadChannelMembers(call, channelID)
    }, [call, channelID, autoFetch])

    const memberIds = useMemo(() => Object.keys(entry.members), [entry.members])

    // Diff-and-reuse cache for the merged member objects (same trick usersStore /
    // channelStore use). `usersById` gets a NEW Map ref whenever ANY user changes
    // anywhere (e.g. an availability flip) — without this cache, that rebuilt every
    // merged object + the array, breaking child memoization for every mounted member
    // list. With it, only members whose OWN user ref or meta fields changed get a new
    // object, and an unchanged roster hands back the previous array ref untouched.
    const mergeCache = useRef<{
        byId: Map<string, { user: UserData; merged: ChannelMemberData }>
        list: ChannelMemberData[]
    } | null>(null)

    const members = useMemo<ChannelMemberData[]>(() => {
        const prev = mergeCache.current
        const nextById = new Map<string, { user: UserData; merged: ChannelMemberData }>()

        const list: ChannelMemberData[] = []
        for (const id of memberIds) {
            const user = usersById.get(id)
            if (!user) continue
            const meta = entry.members[id]
            const cached = prev?.byId.get(id)
            // Reuse when inputs are unchanged: user object refs are kept stable by
            // usersStore's diffing; meta is compared by field so reuse survives a
            // members refetch that returns the same values.
            const record =
                cached &&
                cached.user === user &&
                cached.merged.is_admin === meta?.is_admin &&
                cached.merged.channel_member_name === meta?.channel_member_name
                    ? cached
                    : {
                        user,
                        merged: {
                            ...user,
                            is_admin: meta?.is_admin,
                            channel_member_name: meta?.channel_member_name,
                        } as ChannelMemberData,
                    }
            nextById.set(id, record)
            list.push(record.merged)
        }

        // Alphabetical only — deliberately NOT admins-first: position depending on
        // admin status made rows jump (toggle someone's admin in the members drawer
        // and they teleport). A stable order beats a grouped one here.
        list.sort((a, b) => (a.full_name || a.name || "").localeCompare(b.full_name || b.name || ""))

        // Same elements in the same order → return the PREVIOUS array ref so
        // downstream memos/effects keyed on `members` don't re-run.
        if (prev && prev.list.length === list.length && list.every((m, i) => m === prev.list[i])) {
            mergeCache.current = { byId: nextById, list: prev.list }
            return prev.list
        }
        mergeCache.current = { byId: nextById, list }
        return list
    }, [memberIds, entry.members, usersById])

    return {
        members,
        memberIds,
        // Loading only while there's NOTHING to show yet. A refresh (force reload
        // after add/remove/admin-toggle, or realtime) keeps the stale list on screen
        // and swaps it in place when the fetch lands — stale-while-revalidate.
        // Flipping to a spinner mid-refresh unmounted the whole members list, which
        // also tore down the nested add-members sheet before it could close through
        // vaul (leaving the parent sheet stuck scaled back).
        isLoading: (entry.status === "idle" || entry.status === "loading") && memberIds.length === 0,
        error: entry.status === "error",
        mutate: () => loadChannelMembers(call, channelID, true),
    }
}
