import { useMemo, useSyncExternalStore } from 'react'
import { channelStore } from "@stores/channels/store"
import { useWorkspaces, WorkspaceFields } from '@hooks/useWorkspaces'
import { usersStore } from '@stores/usersStore'
import { UserData } from '@db'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'

/**
 * O(1) lookup Maps for message-row virtualization. Use these in place of
 * per-row `useUser` / `useChannel` SWR subscriptions inside virtualized lists
 * (search results, notifications, threads, saved, etc.).
 *
 * Each sub-hook returns a stable Map keyed by `.name`. Compose via
 * `useMessageRowLookups()` when you need all four.
 */

/** All consumers share usersStore's single snapshot — see that file for why. */
export const useUsersById = (): Map<string, UserData> =>
    useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot)

/** Store-backed snapshot: ONE Map build per actual channel-list change, shared by all
 *  consumers (no per-consumer rebuilds), and ref-stable across DM-only writes. */
export const useChannelsById = (): Map<string, ChannelListItem> =>
    useSyncExternalStore(channelStore.subscribe, channelStore.getChannelsById)

/** Mirror of useChannelsById for DMs — ref-stable across channel-only writes. */
export const useDMsById = (): Map<string, DMChannelListItem> =>
    useSyncExternalStore(channelStore.subscribe, channelStore.getDMsById)

export const useWorkspacesById = (): Map<string, WorkspaceFields> => {
    const { workspaces } = useWorkspaces()
    return useMemo(() => {
        const m = new Map<string, WorkspaceFields>()
        for (const w of workspaces) m.set(w.name, w)
        return m
    }, [workspaces])
}

/**
 * Composed lookup hook. Pre-builds user / channel / dm-channel / workspace
 * Maps once per parent render so virtualized rows can resolve refs with
 * O(1) `Map.get()` instead of firing async SWR hooks per row.
 *
 * Without this, each visible row triggers useUser + useChannel + useUser(peer)
 * — 3 SWR subscriptions that each re-render the row when they resolve,
 * producing 30-50 mounts/updates while scrolling.
 */
export const useMessageRowLookups = () => ({
    usersById: useUsersById(),
    channelById: useChannelsById(),
    dmById: useDMsById(),
    workspaceById: useWorkspacesById(),
})
