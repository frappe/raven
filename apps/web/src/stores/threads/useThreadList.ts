import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { subscribeConnectionEpoch } from "@stores/connectionFreshness"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { ThreadTab, searchViewKey, threadListStore } from "./listStore"
import { selectThreadRows } from "./listSelectors"
import {
    loadInitialThreads,
    loadMoreThreads,
    reconcileFirstPage,
    reconcileViewIfStale,
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

    // The initial load heals staleness on OPEN — but the connection can also break
    // while the user is sitting on the page (lock the phone on it, come back).
    // While this view is mounted, reconcile as soon as a break is recorded. Search
    // snapshots are excluded: they're re-run per keystroke, not kept live.
    useEffect(() => {
        if (isSearch) return
        return subscribeConnectionEpoch(() => reconcileViewIfStale(client, tab, viewKey, filters))
    }, [client, tab, viewKey, isSearch, filters])

    // New-unread-thread reconcile: if an unread id isn't in this view's window, refetch the
    // first page once (the event has no row data). `state` IS a dependency so the check
    // re-runs once the window finishes loading (without it, an unread id arriving mid-load
    // was never re-checked). The reconciledRef guard — keyed on the (viewKey, unread
    // snapshot) pair — is what keeps unrelated live bumps from re-FETCHING, and an id that
    // can never surface (Other-tab membership, a different channel filter) from spinning:
    // re-runs are a cheap set scan, a refetch needs a new unread snapshot.
    const reconcilingRef = useRef(false)
    const reconciledRef = useRef<{ viewKey: string; set: ReadonlySet<string> } | null>(null)
    useEffect(() => {
        if (isSearch) return
        if (reconciledRef.current?.viewKey === viewKey && reconciledRef.current?.set === unreadSet) return
        if (state.status !== "ready") return
        let missing = false
        for (const id of unreadSet) {
            if (!state.byId.has(id)) {
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
    }, [client, tab, isSearch, viewKey, unreadSet, filters, state])

    const loadMore = useCallback(() => {
        loadMoreThreads(client, tab, viewKey, filters)
    }, [client, tab, viewKey, filters])

    // Session-sticky unread view (same pattern as useNotificationList): a thread the user is
    // LOOKING at must not vanish the moment it's read — clicking it clears its unread
    // (onThreadClick → unreadThreadsStore.remove), which would otherwise yank the row out of
    // the filtered list while its pane opens beside it. Every row displayed unread in this
    // view is remembered and survives the filter (rendered as read). Reset synchronously on
    // view change (an effect would leave one stale frame), re-applying the filter cleanly.
    const seenUnreadRef = useRef<Set<string>>(new Set())
    const seenViewKeyRef = useRef(viewKey)
    if (seenViewKeyRef.current !== viewKey) {
        seenViewKeyRef.current = viewKey
        seenUnreadRef.current = new Set()
    }

    const rows = useMemo(() => {
        const selected = selectThreadRows(state, {
            channelFilter: channel,
            onlyShowUnread,
            unreadSet,
            keepIds: seenUnreadRef.current,
        })
        if (onlyShowUnread) {
            for (const row of selected) {
                if (row._isUnread) seenUnreadRef.current.add(row.name)
            }
        }
        return selected
    }, [state, channel, onlyShowUnread, unreadSet])

    return {
        rows,
        isLoading: state.status === "idle" || state.status === "loading",
        error: state.status === "error" ? state.error : null,
        hasMore: state.hasMore,
        loadMore,
    }
}
