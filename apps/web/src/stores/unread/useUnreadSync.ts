import { useEffect } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import { channelUnreadStore } from "./store"
import { markUnreadSeeded } from "@hooks/useClearReadNotifications"

type UnreadCountRow = { name: string; is_direct_message: 0 | 1; unread_count: number }

// Module-level on purpose: touches only module singletons, so it has no
// business inside the render cycle.
const applyUnreadCounts = (message: UnreadCountRow[] | undefined) => {
    if (!message) return
    const counts = new Map<string, number>()
    for (const row of message) counts.set(row.name, Number(row.unread_count) || 0)
    channelUnreadStore.reconcile(counts)
    // The store now holds the server's full truth — stale tray notifications
    // (for channels read on other devices) can be swept safely.
    markUnreadSeeded("channels")
}

/**
 * Seeds and reconciles the unread store with the server's authoritative
 * per-channel counts. Mounted once at the app shell. Realtime increments keep
 * counts live between fetches; this self-heals any drift on mount, window focus,
 * and reconnect — so a missed or out-of-order socket event can't strand a count.
 */
export const useUnreadSync = () => {
    const { data } = useFrappeGetCall<{ message: UnreadCountRow[] }>(
        "raven.api.raven_message.get_unread_count_for_channels",
        undefined,
        "unread_channel_counts",
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            // Reconcile on every FETCH, not just on data change: SWR deep-compares
            // responses and keeps the same `data` reference when the payload matches
            // the previous fetch — but the STORE drifts from that payload via
            // realtime increments in between, so a refetch returning the same
            // counts as last time must still overwrite the store. Same bug family
            // as useUnreadNotificationsSync (see performance-engineering.md).
            onSuccess: (fetched) => applyUnreadCounts(fetched?.message),
        },
    )

    // Still needed for cache-served data (a remount inside the deduping window
    // gets `data` without a request, so onSuccess doesn't fire).
    useEffect(() => applyUnreadCounts(data?.message), [data])
}
