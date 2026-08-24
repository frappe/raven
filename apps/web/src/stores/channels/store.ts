import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"

type Listener = () => void

/**
 * Shallow-equal over the fields that actually change at runtime (rename, archive,
 * the DM-preview last_message_* patch, membership). `name` is the key (equal by
 * construction). Used to reuse a channel's object reference when nothing changed.
 */
const sameChannel = (a: ChannelListItem, b: ChannelListItem): boolean =>
    a.channel_name === b.channel_name &&
    a.type === b.type &&
    a.is_archived === b.is_archived &&
    a.channel_description === b.channel_description &&
    a.workspace === b.workspace &&
    a.last_message_timestamp === b.last_message_timestamp &&
    a.last_message_details === b.last_message_details &&
    a.pinned_messages_string === b.pinned_messages_string &&
    a.member_id === b.member_id &&
    a.is_admin === b.is_admin &&
    a.allow_notifications === b.allow_notifications &&
    a.muted === b.muted &&
    (a as DMChannelListItem).peer_user_id === (b as DMChannelListItem).peer_user_id

/**
 * Singleton channel list — the single source of truth for channels + DMs, replacing
 * the SWR `'channel_list'` cache. Like usersStore: ONE set of reference-stable
 * snapshots shared via useSyncExternalStore, with two subscription granularities:
 *   - subscribe / getChannels / getDMChannels : the whole list (sidebar)
 *   - subscribeChannel / getChannel : one channel (useChannel) — only that channel's
 *     watchers wake when it changes (e.g. a DM-preview tick re-renders one row)
 *
 * On every update we DIFF against the previous snapshot and REUSE unchanged channel
 * object references, so a single last_message_details patch keeps every other row's
 * identity stable and notifies only the channel(s) that actually changed.
 *
 * Layer A seeds/reconciles from a fetch; realtime delta reducers (single writer,
 * race-free — the whole point) land in a later layer.
 */
class ChannelStore {
    /** Both channels and DMs, by name — for getChannel / per-channel diffing. */
    private byId = new Map<string, ChannelListItem>()
    private channels: ChannelListItem[] = []
    private dmChannels: DMChannelListItem[] = []
    private listeners = new Set<Listener>()
    private channelListeners = new Map<string, Set<Listener>>()
    /** False until the first reconcile lands — drives isLoading. */
    private loaded = false

    /** Whether the channel list has been seeded at least once. */
    isLoaded = () => this.loaded

    /**
     * Replace the list with the server's authoritative set, reusing references for
     * unchanged channels. Seeds on first load and self-heals drift on revalidate.
     */
    reconcile(channels: ChannelListItem[], dmChannels: DMChannelListItem[]) {
        const wasLoaded = this.loaded
        this.loaded = true
        const prevById = this.byId
        const nextById = new Map<string, ChannelListItem>()
        const changed = new Set<string>()

        const build = <T extends ChannelListItem>(prevList: T[], incoming: T[]): T[] => {
            let identical = prevList.length === incoming.length
            const next = incoming.map((item, index) => {
                const existing = prevById.get(item.name) as T | undefined
                const resolved = existing && sameChannel(existing, item) ? existing : item
                if (resolved !== existing) changed.add(item.name)
                if (resolved !== prevList[index]) identical = false
                nextById.set(item.name, resolved)
                return resolved
            })
            return identical ? prevList : next
        }

        const nextChannels = build(this.channels, channels)
        const nextDMs = build(this.dmChannels, dmChannels)

        // Channels that were present before and are now gone (left / archived-out / deleted).
        for (const name of prevById.keys()) {
            if (!nextById.has(name)) changed.add(name)
        }

        const listChanged = nextChannels !== this.channels || nextDMs !== this.dmChannels
        if (!listChanged && changed.size === 0) {
            // First seed with an empty list still has to flip isLoading off.
            if (!wasLoaded) this.listeners.forEach((listener) => listener())
            return
        }

        this.channels = nextChannels
        this.dmChannels = nextDMs
        this.byId = nextById
        for (const name of changed) this.channelListeners.get(name)?.forEach((listener) => listener())
        this.listeners.forEach((listener) => listener())
    }

    /** ----- Delta reducers (single writer — replace optimistic SWR cache mutations) ----- */

    /**
     * Merge a partial into one channel (e.g. the DM-preview last_message_* on every
     * message). No-op if the channel isn't in the list or nothing changed. Rebuilds
     * the affected list array so the sidebar's recency sort re-runs.
     */
    patchChannel(channelID: string, patch: Partial<ChannelListItem>) {
        const existing = this.byId.get(channelID)
        if (!existing) return
        this.commitChannel({ ...existing, ...patch }, false)
    }

    /** Add a channel (optimistic create) or replace an existing one. */
    upsertChannel(channel: ChannelListItem) {
        this.commitChannel(channel, true)
    }

    /** Shared write path for patch/upsert: ref-stable update + notify. */
    private commitChannel(channel: ChannelListItem, allowInsert: boolean) {
        const existing = this.byId.get(channel.name)
        if (!existing && !allowInsert) return
        if (existing && sameChannel(existing, channel)) return

        const nextById = new Map(this.byId)
        nextById.set(channel.name, channel)
        this.byId = nextById

        const isDM = channel.is_direct_message === 1
        const list = isDM ? this.dmChannels : this.channels
        const nextList = existing
            ? list.map((item) => (item.name === channel.name ? channel : item))
            : [...list, channel]
        if (isDM) this.dmChannels = nextList as DMChannelListItem[]
        else this.channels = nextList

        this.channelListeners.get(channel.name)?.forEach((listener) => listener())
        this.listeners.forEach((listener) => listener())
    }

    /** ----- Whole list (sidebar) ----- */

    subscribe = (listener: Listener) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    /** Stable reference between changes — required by useSyncExternalStore. */
    getChannels = () => this.channels
    getDMChannels = () => this.dmChannels

    /** ----- byId snapshots (useChannelsById / useDMsById) -----
     * Lazily derived, cached on the source ARRAY's identity: one Map build per actual
     * list change, shared by every consumer — replaces the old per-consumer useMemo
     * rebuilds. Deliberately TWO maps (not the internal combined `byId`): consumers
     * discriminate channel-vs-DM by which map hits for an id. Memoized stable-return
     * getters are safe as useSyncExternalStore snapshots. */
    private channelsByIdCache: { source: ChannelListItem[]; map: Map<string, ChannelListItem> } | null = null
    private dmsByIdCache: { source: DMChannelListItem[]; map: Map<string, DMChannelListItem> } | null = null

    getChannelsById = (): Map<string, ChannelListItem> => {
        if (this.channelsByIdCache?.source !== this.channels) {
            const map = new Map<string, ChannelListItem>()
            for (const channel of this.channels) map.set(channel.name, channel)
            this.channelsByIdCache = { source: this.channels, map }
        }
        return this.channelsByIdCache.map
    }

    getDMsById = (): Map<string, DMChannelListItem> => {
        if (this.dmsByIdCache?.source !== this.dmChannels) {
            const map = new Map<string, DMChannelListItem>()
            for (const dm of this.dmChannels) map.set(dm.name, dm)
            this.dmsByIdCache = { source: this.dmChannels, map }
        }
        return this.dmsByIdCache.map
    }

    /** ----- Single channel ----- */

    subscribeChannel = (channelID: string, listener: Listener) => {
        let set = this.channelListeners.get(channelID)
        if (!set) {
            set = new Set()
            this.channelListeners.set(channelID, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.channelListeners.delete(channelID)
        }
    }

    /** Reference-stable per channel between changes to THAT channel. */
    getChannel = (channelID: string): ChannelListItem | undefined => this.byId.get(channelID)
}

export const channelStore = new ChannelStore()
