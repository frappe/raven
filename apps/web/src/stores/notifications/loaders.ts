import type { FrappeConfig } from "frappe-react-sdk"
import { getConnectionEpoch, isWindowStale, markWindowFresh } from "@stores/connectionFreshness"
import { notificationListStore, type NotificationFilters, type NotificationObject } from "./store"

export type NotificationCall = FrappeConfig["call"]

export const PAGE_SIZE = 10

/** Key under which this view's "last fetched before/after the connection broke"
 *  stamp is stored. Prefixed so it can't collide with the channel ids the
 *  message windows use in the same stamp map. */
const freshnessKey = (viewKey: string) => `notifications:${viewKey}`

/** Views with a page-0 reconcile currently running. Several callers can ask for
 *  the same reconcile in one moment (a realtime event, the resume check, the
 *  on-open check) — instead of firing duplicate requests, the extra asks set
 *  `rerun` and ONE follow-up fetch runs when the current one finishes. The
 *  follow-up matters: a request that was already in flight when a new event
 *  arrived may predate that event's data, so simply dropping the ask could lose
 *  the newest notification. */
const reconcilesInFlight = new Map<string, { rerun: boolean }>()

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

/** Initial load of a view's window. Warm views aren't refetched — but if the
 *  realtime connection broke since the window was fetched (phone locked, PWA
 *  frozen), the events that kept it live were dropped, so quietly merge a fresh
 *  page 0 behind the instant render instead of trusting it. */
export const loadInitialNotifications = async (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    // Record the filters even when warm, so the realtime hook can always refetch this view.
    notificationListStore.setFilters(viewKey, filters)
    if (notificationListStore.isLoaded(viewKey)) {
        reconcileViewIfStale(call, viewKey, filters)
        return
    }
    notificationListStore.startLoading(viewKey)
    const epochAtStart = getConnectionEpoch()
    try {
        const rows = await fetchPage(call, 0, filters)
        notificationListStore.setInitialPage(viewKey, rows, rows.length === PAGE_SIZE)
        markWindowFresh(freshnessKey(viewKey), epochAtStart)
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

/** Refetch page 0 and merge it into the window. This is how new rows actually
 *  arrive: the mention/reaction events carry no row data, only "something
 *  changed" — so whoever hears one calls this. Merging keeps rows the page
 *  already had (nothing the user is looking at disappears). */
export const reconcileFirstPage = async (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    const inFlight = reconcilesInFlight.get(viewKey)
    if (inFlight) {
        inFlight.rerun = true
        return
    }
    const token = { rerun: false }
    reconcilesInFlight.set(viewKey, token)
    // Read the break counter BEFORE fetching: if the connection breaks while the
    // request runs, the response is from before the break and must stay suspect.
    const epochAtStart = getConnectionEpoch()
    try {
        const rows = await fetchPage(call, 0, filters)
        notificationListStore.reconcilePage(viewKey, rows)
        markWindowFresh(freshnessKey(viewKey), epochAtStart)
    } catch {
        /* best-effort backstop; ignore */
    } finally {
        reconcilesInFlight.delete(viewKey)
        // Someone asked again while we were fetching — run once more so the
        // window ends up including whatever that ask was about.
        if (token.rerun) reconcileFirstPage(call, viewKey, filters)
    }
}

/** Refetch page 0 only if the connection broke since this view was last fetched
 *  (events from the gap are lost — the window can't be trusted). While the
 *  connection never broke this is a few map lookups and no request, so it's
 *  safe to call on every page open and every recorded break. */
export const reconcileViewIfStale = (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    // Only a fully loaded window can be quietly out of date — a loading one is
    // being fetched right now, and an error one gets no silent fixups.
    if (notificationListStore.getState(viewKey).status !== "ready") return
    if (!isWindowStale(freshnessKey(viewKey))) return
    reconcileFirstPage(call, viewKey, filters)
}
