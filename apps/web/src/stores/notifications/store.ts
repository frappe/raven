import {
    NotificationListState,
    NotificationObject,
    NotificationTab,
    applyInitialPage,
    beginPagination,
    endPagination,
    initialNotificationListState,
    markError,
    markLoading,
    mergePage,
    patchAllRead,
    patchRead,
} from "./reducers"

type Listener = () => void

/** Server-side filters for a notifications window. */
export type NotificationFilters = { notificationType?: "mention" | "reaction"; unreadOnly?: boolean }

/**
 * Single writer for the notifications feed, keyed by a view key that encodes the active
 * filters (`all`, `all:unread`, `mention`, `mention:unread`, `reaction`, `reaction:unread`).
 * Each view is its OWN server-filtered, paginated window — so the unread toggle and the
 * mention/reaction tabs are complete and dense (client-only filtering over a single merged
 * window would hide matches beyond the loaded page and could stall the infinite scroll).
 *
 * Read-state actions patch EVERY loaded view (a notification is read everywhere at once).
 * Mirrors channelMessagesStore / threadListStore: stores outlive components, no-op reducers
 * return the same reference so duplicate events cause zero re-renders.
 */
class NotificationListStore {
    private states = new Map<string, NotificationListState>()
    private listeners = new Map<string, Set<Listener>>()
    /** Filters per view, recorded on load so the realtime hook can refetch with them. */
    private filters = new Map<string, NotificationFilters>()

    getState(viewKey: string): NotificationListState {
        let state = this.states.get(viewKey)
        if (!state) {
            state = initialNotificationListState
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

    /** Record a view's filters so realtime reconcile can refetch the right server slice. */
    setFilters(viewKey: string, filters: NotificationFilters) {
        this.filters.set(viewKey, filters)
    }

    /** Loaded views + their filters — for the global realtime hook to reconcile each. */
    loadedViews(): { viewKey: string; filters: NotificationFilters }[] {
        const out: { viewKey: string; filters: NotificationFilters }[] = []
        for (const [viewKey, s] of this.states) {
            if (s.status !== "idle") out.push({ viewKey, filters: this.filters.get(viewKey) ?? {} })
        }
        return out
    }

    /** ----- Fetch lifecycle ----- */

    startLoading(viewKey: string) {
        this.update(viewKey, markLoading(this.getState(viewKey)))
    }

    failLoading(viewKey: string, error: string) {
        this.update(viewKey, markError(this.getState(viewKey), error))
    }

    setInitialPage(viewKey: string, rows: NotificationObject[], hasMore: boolean) {
        this.update(viewKey, applyInitialPage(this.getState(viewKey), rows, hasMore))
    }

    appendPage(viewKey: string, rows: NotificationObject[], hasMore: boolean) {
        this.update(viewKey, mergePage(this.getState(viewKey), rows, hasMore))
    }

    /** Upsert page 0 after a live event — keep hasMore. */
    reconcilePage(viewKey: string, rows: NotificationObject[]) {
        const current = this.getState(viewKey)
        this.update(viewKey, mergePage(current, rows, current.hasMore))
    }

    beginLoadMore(viewKey: string): boolean {
        const s = this.getState(viewKey)
        if (s.status !== "ready" || s.loadingMore || !s.hasMore) return false
        this.update(viewKey, beginPagination(s))
        return true
    }

    endLoadMore(viewKey: string) {
        this.update(viewKey, endPagination(this.getState(viewKey)))
    }

    /** ----- Read-state actions (optimistic + realtime echo); applied to ALL views ----- */

    markMessageRead(messageId: string) {
        for (const viewKey of this.states.keys()) {
            this.update(viewKey, patchRead(this.getState(viewKey), messageId))
        }
    }

    markAllRead() {
        for (const viewKey of this.states.keys()) {
            this.update(viewKey, patchAllRead(this.getState(viewKey)))
        }
    }

    /** ----- Internals ----- */

    private update(viewKey: string, next: NotificationListState) {
        const current = this.states.get(viewKey)
        if (current === next) return
        this.states.set(viewKey, next)
        this.listeners.get(viewKey)?.forEach((listener) => listener())
    }
}

export const notificationListStore = new NotificationListStore()
export type { NotificationListState, NotificationObject, NotificationTab }
