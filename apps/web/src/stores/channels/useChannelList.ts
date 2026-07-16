import { useSyncExternalStore, useCallback } from "react"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { channelStore } from "./store"

/**
 * BOTH lists. Prefer useChannels / useDMChannels unless you genuinely need both:
 * this hook re-renders its consumer on ANY list change — including the DM-preview
 * patch that fires on every incoming DM message.
 */
export const useChannelList = () => {
    const channels = useSyncExternalStore(channelStore.subscribe, channelStore.getChannels)
    const dmChannels = useSyncExternalStore(channelStore.subscribe, channelStore.getDMChannels)
    const isLoading = !useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)
    return { channels, dmChannels, isLoading }
}

/**
 * Channels ONLY. The store keeps the two list refs independent — a DM-preview patch
 * (every incoming DM message, the store's hottest write) replaces only dmChannels —
 * so consumers of this hook bail out of those and re-render only on channel changes.
 */
export const useChannels = () => {
    const channels = useSyncExternalStore(channelStore.subscribe, channelStore.getChannels)
    const isLoading = !useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)
    return { channels, isLoading }
}

/** DM channels ONLY — the mirror of useChannels (no wake-ups on channel-list changes). */
export const useDMChannels = () => {
    const dmChannels = useSyncExternalStore(channelStore.subscribe, channelStore.getDMChannels)
    const isLoading = !useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)
    return { dmChannels, isLoading }
}

/**
 * A single channel by id, read from the store. Subscribes to ONLY that channel, so a
 * change to one channel (e.g. its DM-preview tick) re-renders just its watchers.
 */
export const useChannelById = (channelID: string): ChannelListItem | undefined => {
    const subscribe = useCallback(
        (listener: () => void) => channelStore.subscribeChannel(channelID, listener),
        [channelID],
    )
    const getSnapshot = useCallback(() => channelStore.getChannel(channelID), [channelID])
    return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Whether the current user can interact (vote, etc.) in a channel: Open
 * channels include everyone by definition; everywhere else membership =
 * member_id (the composer join gate's signal). Unknown ids (threads — not in
 * this store) → true; the server has the final say there.
 *
 * Snapshot is the BOOLEAN, not the channel object, for the same reason as
 * useChannelPinnedString below: the object's identity changes on every patch
 * (each incoming message's last-message tick), which would re-render every
 * subscriber per message — the primitive only notifies when the answer flips.
 */
export const useCanInteractInChannel = (channelID: string): boolean => {
    const subscribe = useCallback(
        (listener: () => void) => channelStore.subscribeChannel(channelID, listener),
        [channelID],
    )
    const getSnapshot = useCallback(() => {
        const channel = channelStore.getChannel(channelID)
        return !channel || channel.type === "Open" || Boolean(channel.member_id)
    }, [channelID])
    return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Just a channel's pinned-messages string. Subscribes to the channel but the snapshot is
 * the primitive string, so it only re-renders when the PINS change — not on every other
 * channel update (e.g. each incoming message's last-message tick).
 */
export const useChannelPinnedString = (channelID: string): string | undefined => {
    const subscribe = useCallback(
        (listener: () => void) => channelStore.subscribeChannel(channelID, listener),
        [channelID],
    )
    const getSnapshot = useCallback(() => channelStore.getChannel(channelID)?.pinned_messages_string, [channelID])
    return useSyncExternalStore(subscribe, getSnapshot)
}
