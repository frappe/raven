import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext, useSWRConfig } from "frappe-react-sdk"
import { useStickyThenLeave } from "@hooks/useStickyThenLeave"
import { subscribeConnectionEpoch } from "@stores/connectionFreshness"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { ThreadTab, searchViewKey, threadListStore } from "./listStore"
import { selectThreadRows, type ThreadRowData } from "./listSelectors"
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
    /** The thread open in the pane — exempt from the unread view's leave pipeline. */
    activeThreadID?: string
}

export const useThreadList = (tab: ThreadTab, { channel, onlyShowUnread, search, activeThreadID }: Options) => {
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

    // Manual refresh (pull-to-refresh / error-state Retry): refetch the first
    // page of this view and revalidate the unread-thread set. Search views
    // re-run their snapshot instead (that's their whole lifecycle).
    const { mutate: globalMutate } = useSWRConfig()
    const refresh = useCallback(async () => {
        if (isSearch) {
            await reloadThreads(client, tab, viewKey, filters)
        } else {
            await reconcileFirstPage(client, tab, viewKey, filters)
        }
        await globalMutate("unread_threads")
    }, [client, tab, viewKey, isSearch, filters, globalMutate])

    // Sticky-then-leave unread view — the shared pipeline (see useStickyThenLeave
    // for the full contract). Unlike notifications there is no explicit/passive
    // split: essentially the only way a thread's unread clears from this page is
    // opening it (here or on another device — either way it's been dealt with).
    // The predicate flipping back to unread — a new reply landing mid-linger or
    // mid-exit — cancels the departure, so a thread never slides out at the
    // moment it becomes relevant again.
    const leave = useStickyThenLeave<ThreadRowData>({
        viewKey,
        enabled: onlyShowUnread,
        getId: (row) => row.name,
        shouldLeave: (row) => !row._isUnread,
        isOpen: (row) => !!activeThreadID && row.name === activeThreadID,
    })

    const rows = useMemo(() => {
        const selected = selectThreadRows(state, {
            channelFilter: channel,
            onlyShowUnread,
            unreadSet,
            keepIds: leave.keepIds,
        })
        if (onlyShowUnread) {
            for (const row of selected) {
                if (row._isUnread) leave.keepIds.add(row.name)
            }
        }
        return selected
        // eslint-disable-next-line react-hooks/exhaustive-deps -- leave.version IS the keepIds dependency
    }, [state, channel, onlyShowUnread, unreadSet, leave.keepIds, leave.version])
    leave.onRows(rows)

    return {
        rows,
        /** Rows mid-exit — render collapsed (LeavingRow). */
        leavingIds: leave.leavingIds,
        isLoading: state.status === "idle" || state.status === "loading",
        error: state.status === "error" ? state.error : null,
        hasMore: state.hasMore,
        loadMore,
        refresh,
    }
}
