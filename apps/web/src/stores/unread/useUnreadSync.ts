import { useEffect } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import { channelUnreadStore } from "./store"
import { markUnreadSeeded } from "@hooks/useClearReadNotifications"

type UnreadCountRow = { name: string; is_direct_message: 0 | 1; unread_count: number }

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
        },
    )

    useEffect(() => {
        if (!data?.message) return
        const counts = new Map<string, number>()
        for (const row of data.message) counts.set(row.name, Number(row.unread_count) || 0)
        channelUnreadStore.reconcile(counts)
        // The store now holds the server's full truth — stale tray notifications
        // (for channels read on other devices) can be swept safely.
        markUnreadSeeded("channels")
    }, [data])
}
