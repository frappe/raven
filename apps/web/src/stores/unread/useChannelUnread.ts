import { useCallback, useMemo, useSyncExternalStore } from "react"
import { useChannels, useDMChannels } from "@stores/channels/useChannelList"
import { channelUnreadStore, type ChannelUnreadState } from "./store"

/**
 * Subscribes a component to one channel's unread state. Reads only — every write
 * goes through the store's inputs (reconcile / increment / markRead). Reference
 * is stable, so a row only re-renders when its own count or watermark changes.
 */
export const useChannelUnread = (channelID: string): ChannelUnreadState =>
    useSyncExternalStore(
        useCallback((onChange) => channelUnreadStore.subscribe(channelID, onChange), [channelID]),
        () => channelUnreadStore.getState(channelID),
    )

/**
 * Number of conversations (channels + DMs) with unread across the app — the tab
 * title's "(N)" prefix. MUTED conversations excluded: the title prefix is an
 * interruption signal, same rule as the icon badge and the footer badges — every
 * aggregate must agree. (Subscribing via the channel-list hooks also means a
 * mute/unmute updates this without an unread-count change.)
 *
 * TODO(perf, only if profiling shows it): this and useHasUnreadChannels subscribe
 * to the channel LIST for muted flags, and the list's array identity changes on
 * every channel patch (each DM last-message tick) — so their consumers
 * (DocumentTitle, the footer's HomeLink) re-render per tick. Both renders are
 * near-trivial today. The fix, if ever needed, is a stable muted-ids selector on
 * the channel store (identity changes only when membership/muted change).
 */
export const useTotalUnread = (): number => {
    const { channels } = useChannels()
    const { dmChannels } = useDMChannels()
    const channelIDs = useMemo(
        () => [...channels, ...dmChannels].filter((channel) => !channel.muted).map((channel) => channel.name),
        [channels, dmChannels],
    )
    return useGroupUnread(channelIDs)
}

/**
 * Number of channels in the set that have unread — a conversation count, not a
 * message sum. Aggregate badges (workspace, DM, collapsed group) answer "how many
 * conversations need attention", so one noisy channel can't inflate them; the
 * per-channel rows still show message counts via useChannelUnread.
 */
export const useGroupUnread = (channelIDs: string[]): number =>
    useSyncExternalStore(
        useCallback((onChange) => channelUnreadStore.subscribeGlobal(onChange), []),
        () => channelIDs.reduce((total, id) => total + (channelUnreadStore.getState(id).count > 0 ? 1 : 0), 0),
    )

/**
 * Sum of unread message counts across the set — a message total, not a conversation
 * count. Used by the collapsed-group badge, which mirrors the per-channel counts it
 * hides (one noisy channel SHOULD inflate it). Contrast useGroupUnread.
 */
export const useGroupUnreadCount = (channelIDs: string[]): number =>
    useSyncExternalStore(
        useCallback((onChange) => channelUnreadStore.subscribeGlobal(onChange), []),
        () => channelIDs.reduce((total, id) => total + channelUnreadStore.getState(id).count, 0),
    )

/**
 * Number of channels with unread in a workspace (conversation count). DMs are
 * excluded — they're workspace-agnostic and surfaced under their own entry.
 * MUTED channels are excluded too: muted means "don't interrupt me", and an
 * aggregate badge is an interruption — aggregates must agree with the rows,
 * which already hide their badges when muted.
 */
export const useWorkspaceUnread = (workspaceID: string): number => {
    const { channels } = useChannels()
    const channelIDs = useMemo(
        () => channels.filter((channel) => channel.workspace === workspaceID && !channel.muted).map((channel) => channel.name),
        [channels, workspaceID],
    )
    return useGroupUnread(channelIDs)
}

/** Number of DM channels with unread (conversation count) — for the Direct Messages
 *  entry. Muted DMs excluded (same rule as useWorkspaceUnread). */
export const useDMUnread = (): number => {
    const { dmChannels } = useDMChannels()
    const channelIDs = useMemo(() => dmChannels.filter((channel) => !channel.muted).map((channel) => channel.name), [dmChannels])
    return useGroupUnread(channelIDs)
}

/**
 * Any non-muted CHANNEL (not DM) with unread, across all workspaces — the mobile
 * footer's Home-tab dot. A boolean on purpose: channels are ambient (a curated
 * sidebar, not an inbox), so Home signals "there's activity" with a dot, while
 * the personal queues (DMs / Threads / Notifications) carry real counts.
 */
export const useHasUnreadChannels = (): boolean => {
    const { channels } = useChannels()
    const channelIDs = useMemo(() => channels.filter((channel) => !channel.muted).map((channel) => channel.name), [channels])
    return useSyncExternalStore(
        useCallback((onChange) => channelUnreadStore.subscribeGlobal(onChange), []),
        () => channelIDs.some((id) => channelUnreadStore.getState(id).count > 0),
    )
}
