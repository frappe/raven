import { useFrappeGetCall } from "frappe-react-sdk"

type CountResult = { message: number }

/** SWR cache key for the unread notifications count (shared by the page header + sidebar badge). */
export const UNREAD_COUNT_KEY = "unread_notifications_count"

/** Fetch the unread notifications count. Kept live by the global notifications realtime hook. */
export const useUnreadNotificationsCount = () => {
    return useFrappeGetCall<CountResult>(
        "raven.api.notifications.get_unread_notifications_count",
        undefined,
        UNREAD_COUNT_KEY,
        { revalidateOnFocus: true, revalidateIfStale: false, dedupingInterval: 2 * 60 * 1000 },
    )
}
