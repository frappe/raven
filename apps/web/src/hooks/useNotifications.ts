import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import { unreadNotificationsStore } from "@stores/notifications/unreadStore"

/** SWR key for the unread-notification message ids (the sync fetch below). Realtime handlers
 *  mutate this key to force a reconcile when an event can't be applied locally. */
export const UNREAD_NOTIFICATION_IDS_KEY = "unread_notification_message_ids"

/**
 * Number of messages with unread notifications — the sidebar/page badge. Derived from the
 * unread-id set's size, so it ticks down instantly as notified messages scroll into view
 * (see markNotificationsReadOnView) with no count fetch.
 */
export const useUnreadNotificationsCount = (): number => {
    return useSyncExternalStore(
        useCallback((onChange) => unreadNotificationsStore.subscribe(onChange), []),
        () => unreadNotificationsStore.getCount(),
    )
}

// Module-level on purpose: touches only the store singleton, so it has no
// business inside the render cycle.
const applyUnreadIds = (message: string[] | undefined) => {
    if (!message) return
    unreadNotificationsStore.reconcile(message)
}

/**
 * Seeds + reconciles the unread-notification id set from the server. Mounted once at the
 * app shell (mirrors useUnreadThreadsSync). The mention/reaction realtime events keep the
 * set live between fetches; this self-heals drift on mount, focus, and reconnect.
 */
export const useUnreadNotificationsSync = () => {
    const { data } = useFrappeGetCall<{ message: string[] }>(
        "raven.api.notifications.get_unread_notification_message_ids",
        undefined,
        UNREAD_NOTIFICATION_IDS_KEY,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            // Reconcile on every FETCH, not just on data change: SWR deep-compares
            // responses and keeps the same `data` reference when the payload matches
            // the previous fetch — but the STORE drifts from that payload via
            // realtime adds in between. Concretely: fetch [], reaction event adds an
            // id to the store, unreact triggers a refetch that returns [] again —
            // deep-equal, an effect on [data] never re-runs, and the stale id (and
            // badge) stuck around forever. onSuccess fires per completed request.
            onSuccess: (fetched) => applyUnreadIds(fetched?.message),
        },
    )

    // Still needed for cache-served data (a remount inside the deduping window
    // gets `data` without a request, so onSuccess doesn't fire).
    useEffect(() => applyUnreadIds(data?.message), [data])
}
