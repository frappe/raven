import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { ThreadTab, searchViewKey, threadListStore } from "./listStore"
import { selectThreadRows } from "./listSelectors"
import {
    loadInitialThreads,
    loadMoreThreads,
    reconcileFirstPage,
    reloadThreads,
    type ThreadCall,
    type ThreadFilters,
} from "./listLoaders"

type Options = {
    channel?: string
    onlyShowUnread: boolean
    search: string
}

export const useThreadList = (tab: ThreadTab, { channel, onlyShowUnread, search }: Options) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as ThreadCall
    const query = search.trim()
    const isSearch = query.length > 0
    const channelActive = !!channel && channel !== "*all"

    // One window per view. Search is a re-runnable snapshot (`<tab>:search`). Otherwise each
    // (channel, unread) combo gets its OWN live, realtime-bumped, warm-reusable window keyed
    // `<tab>:f:<channel>:<u|a>`, and the filters are pushed to the server (see ThreadFilters)
    // so every view is complete + dense — no client-side filtering over a partial window.
    const viewKey = isSearch
        ? searchViewKey(tab)
        : channelActive || onlyShowUnread
          ? `${tab}:f:${channelActive ? channel : "all"}:${onlyShowUnread ? "u" : "a"}`
          : tab

    const filters: ThreadFilters = useMemo(
        () => ({ channel, content: isSearch ? query : undefined, onlyShowUnread }),
        [channel, isSearch, query, onlyShowUnread],
    )

    const state = useSyncExternalStore(
        useCallback((onChange) => threadListStore.subscribe(viewKey, onChange), [viewKey]),
        () => threadListStore.getState(viewKey),
    )

    // Live unread set — drives the unread filter, the dot, and the new-thread reconcile.
    // Canonical useSyncExternalStore object pattern: the store hands back a STABLE snapshot
    // reference that changes identity only when membership changes, so React re-renders on
    // every change (including same-size swaps) without a version/useMemo indirection.
    const unreadSet = useSyncExternalStore(
        useCallback((onChange) => unreadThreadsStore.subscribe(onChange), []),
        () => unreadThreadsStore.getSnapshot(),
    )

    // Live / filtered view: fetch the first page on first visit (warm-reused afterwards).
    useEffect(() => {
        if (isSearch) return
        loadInitialThreads(client, tab, viewKey, filters)
    }, [client, tab, viewKey, isSearch, filters])

    // Search: replace the snapshot whenever the query (or channel) changes.
    useEffect(() => {
        if (!isSearch) return
        reloadThreads(client, tab, viewKey, filters)
    }, [client, tab, viewKey, isSearch, filters])

    // New-unread-thread reconcile: if an unread id isn't in this view's window, refetch the
    // first page once (the event has no row data). Keyed on the (viewKey, unread snapshot)
    // pair — NOT on `state` — so unrelated live bumps don't re-trigger it, and an id that can
    // never surface (Other-tab membership, a different channel filter) won't spin.
    const reconcilingRef = useRef(false)
    const reconciledRef = useRef<{ viewKey: string; set: ReadonlySet<string> } | null>(null)
    useEffect(() => {
        if (isSearch) return
        if (reconciledRef.current?.viewKey === viewKey && reconciledRef.current?.set === unreadSet) return
        const current = threadListStore.getState(viewKey)
        if (current.status !== "ready") return
        let missing = false
        for (const id of unreadSet) {
            if (!current.byId.has(id)) {
                missing = true
                break
            }
        }
        if (!missing || reconcilingRef.current) return
        reconcilingRef.current = true
        reconciledRef.current = { viewKey, set: unreadSet }
        reconcileFirstPage(client, tab, viewKey, filters).finally(() => {
            reconcilingRef.current = false
        })
    }, [client, tab, isSearch, viewKey, unreadSet, filters])

    const loadMore = useCallback(() => {
        loadMoreThreads(client, tab, viewKey, filters)
    }, [client, tab, viewKey, filters])

    const rows = useMemo(
        () => selectThreadRows(state, { channelFilter: channel, onlyShowUnread, unreadSet }),
        [state, channel, onlyShowUnread, unreadSet],
    )

    return {
        rows,
        isLoading: state.status === "idle" || state.status === "loading",
        error: state.status === "error" ? state.error : null,
        hasMore: state.hasMore,
        loadMore,
    }
}
