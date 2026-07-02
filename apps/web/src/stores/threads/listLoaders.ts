import type { FrappeConfig } from "frappe-react-sdk"
import type { ThreadMessage } from "src/types/ThreadMessage"
import { ThreadTab, threadListStore } from "./listStore"

export type ThreadCall = FrappeConfig["call"]

export const PAGE_SIZE = 10

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

/** First page for a view (live tab or a filter combo). No-op if already loaded (warm). */
export const loadInitialThreads = async (
    call: ThreadCall,
    tab: ThreadTab,
    viewKey: string,
    filters: ThreadFilters,
) => {
    if (threadListStore.isLoaded(viewKey)) return
    threadListStore.startLoading(viewKey)
    try {
        const rows = await fetchPage(call, tab, 0, filters)
        threadListStore.setInitialPage(viewKey, rows, rows.length === PAGE_SIZE)
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
    try {
        const rows = await fetchPage(call, tab, 0, filters)
        threadListStore.reconcilePage(viewKey, rows)
    } catch {
        /* best-effort backstop; ignore */
    }
}
