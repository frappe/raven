import type { FrappeConfig } from "frappe-react-sdk"
import { notificationListStore, type NotificationFilters, type NotificationObject } from "./store"

export type NotificationCall = FrappeConfig["call"]

export const PAGE_SIZE = 10

type NotificationsResponse = { message: NotificationObject[] }

const ENDPOINT = "raven.api.notifications.get_notifications"

/** Push the filters to the server so each view is complete + dense (no client-only slicing). */
const fetchPage = (
    call: NotificationCall,
    start: number,
    filters: NotificationFilters,
): Promise<NotificationObject[]> =>
    call
        .get<NotificationsResponse>(ENDPOINT, {
            notification_type: filters.notificationType, // undefined → merged mentions + reactions
            unread_only: filters.unreadOnly ? true : undefined,
            limit: PAGE_SIZE,
            start,
        })
        .then((res) => res.message ?? [])

/** Initial load of a view's window. No-op if already warm. */
export const loadInitialNotifications = async (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    // Record the filters even when warm, so the realtime hook can always refetch this view.
    notificationListStore.setFilters(viewKey, filters)
    if (notificationListStore.isLoaded(viewKey)) return
    notificationListStore.startLoading(viewKey)
    try {
        const rows = await fetchPage(call, 0, filters)
        notificationListStore.setInitialPage(viewKey, rows, rows.length === PAGE_SIZE)
    } catch (e) {
        notificationListStore.failLoading(viewKey, e instanceof Error ? e.message : String(e))
    }
}

/** Append the next page (driven lazily by Virtuoso endReached). */
export const loadMoreNotifications = async (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    if (!notificationListStore.beginLoadMore(viewKey)) return
    try {
        const start = notificationListStore.getState(viewKey).order.length
        const rows = await fetchPage(call, start, filters)
        notificationListStore.appendPage(viewKey, rows, rows.length === PAGE_SIZE)
    } catch {
        notificationListStore.endLoadMore(viewKey)
    }
}

/** Refetch page 0 and merge it (live new-item backstop; the event carries no row data). */
export const reconcileFirstPage = async (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    try {
        const rows = await fetchPage(call, 0, filters)
        notificationListStore.reconcilePage(viewKey, rows)
    } catch {
        /* best-effort backstop; ignore */
    }
}
