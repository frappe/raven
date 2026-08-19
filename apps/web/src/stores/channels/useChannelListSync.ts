import { useEffect } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import type { ChannelList } from "@raven/types/common/ChannelListItem"
import { channelStore } from "./store"

/**
 * Owns the channel-list fetch and seeds/reconciles the store. Mounted once at the
 * app shell — the single source of the `'channel_list'` request now (consumers read
 * the store, not SWR). Revalidates on focus (throttled to once a minute so alt-tabbing
 * doesn't spam) / reconnect / stale, each time reconciling the store against the server's
 * authoritative list — this is what recovers DM teasers/ordering missed while backgrounded.
 */
// Module-level on purpose: touches only the store singleton, so it has no
// business inside the render cycle — and its stable identity keeps the effect
// below honest about its deps.
const applyChannelList = (message: ChannelList | undefined) => {
    if (!message) return
    channelStore.reconcile(message.channels ?? [], message.dm_channels ?? [])
}

export const useChannelListSync = () => {
    const { data } = useFrappeGetCall<{ message: ChannelList }>(
        "raven.api.raven_channel.get_all_channels",
        { hide_archived: false },
        "channel_list",
        {
            revalidateOnFocus: true,
            focusThrottleInterval: 60_000,
            revalidateIfStale: true,
            revalidateOnReconnect: true,
            // Reconcile on every FETCH, not just on data change: SWR deep-compares
            // responses and keeps the same `data` reference when the payload matches
            // the previous fetch — but the STORE can have drifted from that payload
            // via realtime/optimistic patches in between (a failed leave/join patch,
            // events applied while the payload itself didn't change). An effect on
            // [data] then never re-runs and the drift this hook exists to heal
            // survives. Same bug family as useUnreadNotificationsSync.
            onSuccess: (fetched) => applyChannelList(fetched?.message),
        },
    )

    // Still needed for cache-served data (a remount inside the deduping window
    // gets `data` without a request, so onSuccess doesn't fire).
    useEffect(() => applyChannelList(data?.message), [data])
}
