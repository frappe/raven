import type { FrappeConfig } from "frappe-react-sdk"
import type { FrappeError } from "frappe-react-sdk"
import type { ThreadMessage } from "src/types/ThreadMessage"
import { getConnectionEpoch, isWindowStale, markWindowFresh, markWindowSuspect } from "@stores/connectionFreshness"
import { ThreadTab, threadListStore } from "./listStore"

export type ThreadCall = FrappeConfig["call"]

export const PAGE_SIZE = 10

/** Key for this view's freshness stamp. The prefix keeps it from clashing
 *  with channel ids, which share the same stamp map. */
const freshnessKey = (viewKey: string) => `threads:${viewKey}`

/** Views that are refetching page 0 right now. Many things can ask for the
 *  same refetch at the same time (the unread backstop, the resume check, the
 *  on-open check). We never fire duplicate requests: extra asks set `rerun`,
 *  and ONE follow-up fetch runs after the current one finishes. The follow-up
 *  is important — a request that was already running may have started before
 *  the new ask's data existed, so just ignoring it could lose rows. */
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

/** First load of a view (a tab or a filter combo). An already-loaded view is
 *  shown as-is — but if the connection broke since it was fetched (phone
 *  locked, app frozen), the events from that gap were lost, so we quietly
 *  refetch page 0 behind the instant render. */
export const loadInitialThreads = async (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
) => {
    // Record the fetch params even when warm, so the realtime hook can always
    // refetch this view (new-thread reconcile below).
    threadListStore.setViewParams(viewKey, tab, filters)
    const status = threadListStore.getState(viewKey).status
    if (status === "ready") {
        reconcileViewIfStale(call, tab, viewKey, filters)
        return
    }
    if (status === "loading") return
    // idle OR error: do a full fetch. A view whose first load FAILED must try
    // again on the next open. Before this check, an errored view counted as
    // already loaded, so it stayed empty forever.
    threadListStore.startLoading(viewKey)
    const epochAtStart = getConnectionEpoch()
    try {
        const rows = await fetchPage(call, tab, 0, filters)
        threadListStore.setInitialPage(viewKey, rows, rows.length === PAGE_SIZE)
        markWindowFresh(freshnessKey(viewKey), epochAtStart)
    } catch (e) {
        threadListStore.failLoading(viewKey, e as FrappeError)
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
        threadListStore.failLoading(viewKey, e as FrappeError)
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
    // Read the break counter BEFORE the fetch: if the connection breaks while
    // the request runs, the response is old news and must not count as fresh.
    const epochAtStart = getConnectionEpoch()
    try {
        const rows = await fetchPage(call, tab, 0, filters)
        threadListStore.reconcilePage(viewKey, rows)
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
        if (token.rerun) reconcileFirstPage(call, tab, viewKey, filters)
    }
}

/** Refetch page 0 only if the connection broke since this view was last
 *  fetched (events from that gap are lost, so the view can't be trusted).
 *  While the connection never broke, this costs a couple of map lookups and
 *  no request — safe to call on every page open. */
export const reconcileViewIfStale = (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
) => {
    const status = threadListStore.getState(viewKey).status
    // A loading view is being fetched right now; an idle one is owned by the
    // initial loader.
    if (status === "loading" || status === "idle") return
    // Reconnect self-heal for a FAILED view: while the page sits mounted on the
    // error card, nothing else retries — this call runs on every connection
    // epoch bump (online, socket reconnect, unfreeze), so fetch page 0 now.
    // A successful page flips the view to ready (mergePage); the staleness
    // stamp is skipped because a failed load never received one.
    if (status === "error") {
        reconcileFirstPage(call, tab, viewKey, filters)
        return
    }
    if (!isWindowStale(freshnessKey(viewKey))) return
    reconcileFirstPage(call, tab, viewKey, filters)
}

/** Remembers which (view, thread) pairs we already tried to refetch — one
 *  try per pair. If the refetch didn't bring the thread in, it doesn't belong
 *  in that view (not a participant, filtered out), and further replies to it
 *  must not trigger a fetch every time. If membership changes later, a normal
 *  load or reconcile picks it up. */
const attemptedUnknownThreads = new Set<string>()

/**
 * A reply arrived for a thread that a loaded view doesn't have. `bump` can only
 * reorder rows that are already there, so a NEW thread would stay invisible in
 * an already-loaded list until a full reload — including the user's own new
 * threads (the unread backstop ignores your own replies). Refetch page 0 of
 * each view missing the thread; the merge either brings the row in or shows it
 * doesn't belong there.
 */
export const reconcileUnknownThread = (call: ThreadCall, threadID: string) => {
    for (const { viewKey, tab, filters } of threadListStore.loadedViews()) {
        if (threadListStore.hasThread(viewKey, threadID)) continue
        const attemptKey = `${viewKey}:${threadID}`
        if (attemptedUnknownThreads.has(attemptKey)) continue
        attemptedUnknownThreads.add(attemptKey)
        reconcileFirstPage(call, tab, viewKey, filters as ThreadFilters)
    }
}
