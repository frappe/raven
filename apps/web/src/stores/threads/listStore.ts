import type { ThreadMessage } from "src/types/ThreadMessage"
import {
    ThreadListState,
    ThreadTab,
    applyInitialPage,
    beginPagination,
    bumpThread,
    endPagination,
    initialThreadListState,
    markError,
    markLoading,
    mergePage,
    removeThread,
} from "./listReducers"

type Listener = () => void

/** The detached search view key for a tab — never receives realtime dispatch. */
export const searchViewKey = (tab: ThreadTab): string => `${tab}:search`

/**
 * Single writer for the threads-list windows, keyed by a string view key.
 * The live feed uses the bare tab (`participating`); the detached search view uses
 * `"<tab>:search"`. Every input — fetched pages, pagination, realtime bumps —
 * goes through these methods, which apply the synchronous reducers.
 *
 * Mirrors channelMessagesStore: stores outlive components, no-op reducers return
 * the same reference so duplicate events cause zero re-renders.
 */
class ThreadListStore {
    private states = new Map<string, ThreadListState>()
    private listeners = new Map<string, Set<Listener>>()

    getState(viewKey: string): ThreadListState {
        let state = this.states.get(viewKey)
        if (!state) {
            state = initialThreadListState
            this.states.set(viewKey, state)
        }
        return state
    }

    subscribe(viewKey: string, listener: Listener): () => void {
        let set = this.listeners.get(viewKey)
        if (!set) {
            set = new Set()
            this.listeners.set(viewKey, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.listeners.delete(viewKey)
        }
    }

    isLoaded(viewKey: string): boolean {
        const s = this.states.get(viewKey)
        return !!s && s.status !== "idle"
    }

    hasThread(viewKey: string, threadID: string): boolean {
        return !!this.states.get(viewKey)?.byId.has(threadID)
    }

    /** ----- Fetch lifecycle ----- */

    startLoading(viewKey: string) {
        this.update(viewKey, markLoading(this.getState(viewKey)))
    }

    failLoading(viewKey: string, error: string) {
        this.update(viewKey, markError(this.getState(viewKey), error))
    }

    /** Replace the window (initial load, tab switch, search snapshot). */
    setInitialPage(viewKey: string, rows: ThreadMessage[], hasMore: boolean) {
        this.update(viewKey, applyInitialPage(this.getState(viewKey), rows, hasMore))
    }

    /** Append a paginated page (upsert + re-sort, keep loaded ids). */
    appendPage(viewKey: string, rows: ThreadMessage[], hasMore: boolean) {
        this.update(viewKey, mergePage(this.getState(viewKey), rows, hasMore))
    }

    /** Reconcile the first page after a live event — upsert without changing hasMore. */
    reconcilePage(viewKey: string, rows: ThreadMessage[]) {
        const current = this.getState(viewKey)
        this.update(viewKey, mergePage(current, rows, current.hasMore))
    }

    beginLoadMore(viewKey: string): boolean {
        const state = this.getState(viewKey)
        if (state.status !== "ready" || state.loadingMore || !state.hasMore) return false
        this.update(viewKey, beginPagination(state))
        return true
    }

    endLoadMore(viewKey: string) {
        this.update(viewKey, endPagination(this.getState(viewKey)))
    }

    remove(viewKey: string, threadID: string) {
        this.update(viewKey, removeThread(this.getState(viewKey), threadID))
    }

    /** Drop a thread from EVERY window — it left/was deleted, so it's gone from all views. */
    removeEverywhere(threadID: string) {
        for (const viewKey of this.states.keys()) {
            this.update(viewKey, removeThread(this.getState(viewKey), threadID))
        }
    }

    /** ----- Realtime ----- */

    /**
     * Apply a thread_reply to every LIVE window that already holds the thread (the default
     * tab AND its filter-combo views, `<tab>:f:...`) — re-sorts it to the top by timestamp.
     * The reply count lives in threadMetaStore, not here. Skips only detached SEARCH
     * snapshots (`<tab>:search`), which shouldn't re-order under the user mid-search.
     */
    bump(threadID: string, lastMessageTimestamp: string) {
        for (const viewKey of this.states.keys()) {
            if (viewKey.endsWith(":search")) continue
            this.update(viewKey, bumpThread(this.getState(viewKey), threadID, lastMessageTimestamp))
        }
    }

    /** ----- Internals ----- */

    private update(viewKey: string, next: ThreadListState) {
        const current = this.states.get(viewKey)
        if (current === next) return
        this.states.set(viewKey, next)
        this.listeners.get(viewKey)?.forEach((listener) => listener())
    }
}

export const threadListStore = new ThreadListStore()
export type { ThreadTab, ThreadListState }
