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
        { revalidateOnFocus: true, revalidateOnReconnect: true },
    )

    useEffect(() => {
        if (!data?.message) return
        unreadNotificationsStore.reconcile(data.message)
    }, [data])
}
