import type { FrappeConfig } from "frappe-react-sdk"
import type { FrappeError } from "frappe-react-sdk"
import { getConnectionEpoch, isWindowStale, markWindowFresh, markWindowSuspect } from "@stores/connectionFreshness"
import { notificationListStore, type NotificationFilters, type NotificationObject } from "./store"

export type NotificationCall = FrappeConfig["call"]

export const PAGE_SIZE = 10

/** Key for this view's freshness stamp. The prefix keeps it from clashing
 *  with channel ids, which share the same stamp map. */
const freshnessKey = (viewKey: string) => `notifications:${viewKey}`

/** Views that are refetching page 0 right now. Many things can ask for the
 *  same refetch at the same time (an event, the resume check, the on-open
 *  check). We never fire duplicate requests: extra asks set `rerun`, and ONE
 *  follow-up fetch runs after the current one finishes. The follow-up is
 *  important — a request that was already running may have started before the
 *  new event's data existed, so just ignoring the ask could lose the newest
 *  notification. */
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

/** First load of a view. An already-loaded view is shown as-is — but if the
 *  connection broke since it was fetched (phone locked, app frozen), the
 *  events that kept it fresh were lost, so we quietly refetch page 0 behind
 *  the instant render. */
export const loadInitialNotifications = async (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    // Record the filters even when warm, so the realtime hook can always refetch this view.
    notificationListStore.setFilters(viewKey, filters)
    const status = notificationListStore.getState(viewKey).status
    if (status === "ready") {
        reconcileViewIfStale(call, viewKey, filters)
        return
    }
    if (status === "loading") return
    // idle OR error: do a full fetch. A view whose first load FAILED must try
    // again on the next open. Before this check, an errored view counted as
    // already loaded, so it stayed empty forever — the page said "all caught
    // up" while the badge showed a count.
    notificationListStore.startLoading(viewKey)
    const epochAtStart = getConnectionEpoch()
    try {
        const rows = await fetchPage(call, 0, filters)
        notificationListStore.setInitialPage(viewKey, rows, rows.length === PAGE_SIZE)
        markWindowFresh(freshnessKey(viewKey), epochAtStart)
    } catch (e) {
        // The error OBJECT is stored (not a message string) so the page can render
        // it with ErrorBanner — the shared, well-tested Frappe error presentation.
        notificationListStore.failLoading(viewKey, e as FrappeError)
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

/** Refetch page 0 and merge it in. This is how new rows arrive: the mention
 *  and reaction events don't carry the row itself, only "something changed" —
 *  so whoever hears one calls this. Merging keeps the rows the view already
 *  had, so nothing the user is looking at disappears. */
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
    // Read the break counter BEFORE the fetch: if the connection breaks while
    // the request runs, the response is old news and must not count as fresh.
    const epochAtStart = getConnectionEpoch()
    try {
        const rows = await fetchPage(call, 0, filters)
        notificationListStore.reconcilePage(viewKey, rows)
        markWindowFresh(freshnessKey(viewKey), epochAtStart)
    } catch {
        // The error itself is ignored on purpose (this is a best-effort fetch).
        // But the view can't be trusted anymore — drop its freshness stamp so
        // the next open retries. Without this, a failed refetch kept a "fresh"
        // stamp and the missed row never showed up.
        markWindowSuspect(freshnessKey(viewKey))
    } finally {
        reconcilesInFlight.delete(viewKey)
        // Someone asked again while we were fetching — run once more so the
        // window ends up including whatever that ask was about.
        if (token.rerun) reconcileFirstPage(call, viewKey, filters)
    }
}

/** Refetch page 0 only if the connection broke since this view was last
 *  fetched (events from that gap are lost, so the view can't be trusted).
 *  While the connection never broke, this costs a couple of map lookups and
 *  no request — safe to call on every page open. */
export const reconcileViewIfStale = (
    call: NotificationCall,
    viewKey: string,
    filters: NotificationFilters,
) => {
    const status = notificationListStore.getState(viewKey).status
    // A loading view is being fetched right now; an idle one is owned by the
    // initial loader.
    if (status === "loading" || status === "idle") return
    // Reconnect self-heal for a FAILED view: while the page sits mounted on the
    // error card, nothing else retries — this call runs on every connection
    // epoch bump (online, socket reconnect, unfreeze), so fetch page 0 now.
    // A successful page flips the view to ready (mergePage); the staleness
    // stamp is skipped because a failed load never received one.
    if (status === "error") {
        reconcileFirstPage(call, viewKey, filters)
        return
    }
    if (!isWindowStale(freshnessKey(viewKey))) return
    reconcileFirstPage(call, viewKey, filters)
}
