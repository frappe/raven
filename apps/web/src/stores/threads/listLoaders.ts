import type { FrappeConfig } from "frappe-react-sdk"
import type { ThreadMessage } from "src/types/ThreadMessage"
import { getConnectionEpoch, isWindowStale, markWindowFresh } from "@stores/connectionFreshness"
import { ThreadTab, threadListStore } from "./listStore"

export type ThreadCall = FrappeConfig["call"]

export const PAGE_SIZE = 10

/** Key under which this view's "last fetched before/after the connection broke"
 *  stamp is stored. Prefixed so it can't collide with the channel ids the
 *  message windows use in the same stamp map. */
const freshnessKey = (viewKey: string) => `threads:${viewKey}`

/** Views with a page-0 reconcile currently running. Several callers can ask for
 *  the same reconcile in one moment (the missing-unread-id backstop, the resume
 *  check, the on-open check) — instead of firing duplicate requests, the extra
 *  asks set `rerun` and ONE follow-up fetch runs when the current one finishes.
 *  The follow-up matters: a request already in flight when a new ask arrived may
 *  predate whatever that ask was about, so simply dropping it could lose rows. */
const reconcilesInFlight = new Map<string, { rerun: boolean }>()

/**
 * Server-side filters. Channel + unread are pushed to the API (not applied only on the
 * client) so a filtered view is COMPLETE and dense: client-only filtering over an
 * unfiltered, timestamp-paginated window would hide matches that live beyond the loaded
 * page, and could stall the infinite scroll when a fetched page contains no matches (the
 * rendered list length wouldn't change, so `endReached` never re-fires).
 */
export type ThreadFilters = { channel?: string; content?: string; onlyShowUnread?: boolean }

const endpointFor = (tab: ThreadTab) =>
    tab === "other" ? "raven.api.threads.get_other_threads" : "raven.api.threads.get_all_threads"

const isAi = (tab: ThreadTab): 0 | 1 => (tab === "ai" ? 1 : 0)

type ThreadsResponse = { message: ThreadMessage[] }

// NOTE: the list does NOT seed threadMetaStore here. The reply count is shown from the
// row's `reply_count` until a row scrolls into view, at which point `loadThreadDetails`
// (members + count) seeds both stores — and that loader is gated on the count being
// absent, so pre-seeding it here would suppress the members fetch.

const fetchPage = (
    call: ThreadCall,
    tab: ThreadTab,
    startAfter: number,
    filters: ThreadFilters,
): Promise<ThreadMessage[]> =>
    call
        .get<ThreadsResponse>(endpointFor(tab), {
            is_ai_thread: isAi(tab),
            channel_id: filters.channel && filters.channel !== "*all" ? filters.channel : undefined,
            content: filters.content || undefined,
            // get_other_threads has no unread filter — and threads you don't participate in
            // can't be unread for you, so the client unread filter yields empty there anyway.
            only_show_unread: tab !== "other" && filters.onlyShowUnread ? true : undefined,
            // v3 lazy-loads members per row on view (see ThreadRow → loadThreadDetails); the
            // API still fetches them inline for v2 (fetch_members defaults True there).
            fetch_members: false,
            start_after: startAfter,
            limit: PAGE_SIZE,
        })
        .then((res) => res.message ?? [])

/** First page for a view (live tab or a filter combo). Warm views aren't
 *  refetched — but if the realtime connection broke since the window was fetched
 *  (phone locked, PWA frozen), the thread_reply bumps from that gap were dropped,
 *  so quietly merge a fresh page 0 behind the instant render. */
export const loadInitialThreads = async (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
) => {
    if (threadListStore.isLoaded(viewKey)) {
        reconcileViewIfStale(call, tab, viewKey, filters)
        return
    }
    threadListStore.startLoading(viewKey)
    const epochAtStart = getConnectionEpoch()
    try {
        const rows = await fetchPage(call, tab, 0, filters)
        threadListStore.setInitialPage(viewKey, rows, rows.length === PAGE_SIZE)
        markWindowFresh(freshnessKey(viewKey), epochAtStart)
    } catch (e) {
        threadListStore.failLoading(viewKey, e instanceof Error ? e.message : String(e))
    }
}

/** Replace a view's window with a fresh first page — used by search, which re-runs as the query changes. */
export const reloadThreads = async (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
) => {
    threadListStore.startLoading(viewKey)
    try {
        const rows = await fetchPage(call, tab, 0, filters)
        threadListStore.setInitialPage(viewKey, rows, rows.length === PAGE_SIZE)
    } catch (e) {
        threadListStore.failLoading(viewKey, e instanceof Error ? e.message : String(e))
    }
}

/** Append the next page for a view. */
export const loadMoreThreads = async (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
) => {
    if (!threadListStore.beginLoadMore(viewKey)) return
    try {
        const startAfter = threadListStore.getState(viewKey).order.length
        const rows = await fetchPage(call, tab, startAfter, filters)
        threadListStore.appendPage(viewKey, rows, rows.length === PAGE_SIZE)
    } catch {
        threadListStore.endLoadMore(viewKey)
    }
}

/**
 * Refetch the first page and merge it into the view. Used when a brand-new unread thread
 * appears (the realtime event carries no row data, only a channel id).
 */
export const reconcileFirstPage = async (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
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
        const rows = await fetchPage(call, tab, 0, filters)
        threadListStore.reconcilePage(viewKey, rows)
        markWindowFresh(freshnessKey(viewKey), epochAtStart)
    } catch {
        /* best-effort backstop; ignore */
    } finally {
        reconcilesInFlight.delete(viewKey)
        // Someone asked again while we were fetching — run once more so the
        // window ends up including whatever that ask was about.
        if (token.rerun) reconcileFirstPage(call, tab, viewKey, filters)
    }
}

/** Refetch page 0 only if the connection broke since this view was last fetched
 *  (events from the gap are lost — the window can't be trusted). While the
 *  connection never broke this is a few map lookups and no request, so it's
 *  safe to call on every page open and every recorded break. */
export const reconcileViewIfStale = (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
) => {
    // Only a fully loaded window can be quietly out of date — a loading one is
    // being fetched right now, and an error one gets no silent fixups.
    if (threadListStore.getState(viewKey).status !== "ready") return
    if (!isWindowStale(freshnessKey(viewKey))) return
    reconcileFirstPage(call, tab, viewKey, filters)
}
