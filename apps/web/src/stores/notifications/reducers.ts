import type { RavenChannel } from "@raven/types/RavenChannelManagement/RavenChannel"
import type { RavenMessage } from "@raven/types/RavenMessaging/RavenMessage"

export type NotificationTab = "all" | "mention" | "reaction"

/**
 * `name` is unique per row (Raven Mention name for mentions, message id for grouped reactions).
 * `reactors` / `reactions` are parallel arrays present only on reaction rows.
 */
export interface NotificationObject {
    name: string
    notification_type: "mention" | "reaction"
    is_read: 0 | 1
    message_id: string
    channel_id: string
    owner: string
    reactors?: string[]
    reactions?: { reaction: string; is_custom: 0 | 1 }[]
    creation: string
    text: string
    content: string
    message_type: RavenMessage["message_type"]
    channel_type: RavenChannel["type"]
    channel_name: string
    workspace?: string
    is_thread: 0 | 1
    is_direct_message: 0 | 1
}

/** One tab's paginated notification window. */
export interface NotificationListState {
    status: "idle" | "loading" | "ready" | "error"
    error: string | null
    /** name → row. References stable unless that row changed. */
    byId: ReadonlyMap<string, NotificationObject>
    /** Row names sorted DESC by creation (index 0 = newest). */
    order: readonly string[]
    hasMore: boolean
    loadingMore: boolean
}

export const initialNotificationListState: NotificationListState = {
    status: "idle",
    error: null,
    byId: new Map(),
    order: [],
    hasMore: false,
    loadingMore: false,
}

/**
 * Descending comparator on creation. Frappe emits fixed-width
 * `YYYY-MM-DD HH:MM:SS.ffffff`, so lexicographic == chronological — no Date parse.
 * Ties break on name (descending) for a stable order.
 */
const sortedOrder = (byId: ReadonlyMap<string, NotificationObject>): string[] =>
    [...byId.keys()].sort((a, b) => {
        const ca = byId.get(a)?.creation ?? ""
        const cb = byId.get(b)?.creation ?? ""
        if (ca !== cb) return ca < cb ? 1 : -1
        return a < b ? 1 : -1
    })

export const markLoading = (state: NotificationListState): NotificationListState =>
    state.status === "loading" ? state : { ...state, status: "loading", error: null }

export const markError = (state: NotificationListState, error: string): NotificationListState => ({
    ...state,
    status: "error",
    error,
    loadingMore: false,
})

/** Replace the window — initial load / tab switch. */
export const applyInitialPage = (
    state: NotificationListState,
    rows: NotificationObject[],
    hasMore: boolean,
): NotificationListState => {
    const byId = new Map<string, NotificationObject>()
    for (const r of rows) byId.set(r.name, r)
    return {
        status: "ready",
        error: null,
        byId,
        order: sortedOrder(byId),
        hasMore,
        loadingMore: false,
    }
}

/**
 * Upsert rows into the window and re-sort, keeping already-loaded ids.
 * Used for pagination (append) AND page-0 reconcile after a live event.
 * Same reference when no row was added or changed.
 */
export const mergePage = (
    state: NotificationListState,
    rows: NotificationObject[],
    hasMore: boolean,
): NotificationListState => {
    if (rows.length === 0) {
        return state.hasMore === hasMore && !state.loadingMore
            ? state
            : { ...state, status: "ready", hasMore, loadingMore: false }
    }
    const byId = new Map(state.byId)
    let changed = false
    for (const r of rows) {
        const prev = byId.get(r.name)
        if (!prev || prev.is_read !== r.is_read || prev.creation !== r.creation) {
            changed = true
        }
        byId.set(r.name, r)
    }
    if (!changed && state.hasMore === hasMore && !state.loadingMore) return state
    return {
        status: "ready",
        error: null,
        byId,
        order: changed ? sortedOrder(byId) : state.order,
        hasMore,
        loadingMore: false,
    }
}

/** Flip is_read=1 on every row whose message_id matches. Same ref if none changed. */
export const patchRead = (state: NotificationListState, messageId: string): NotificationListState => {
    let byId: Map<string, NotificationObject> | null = null
    for (const [name, row] of state.byId) {
        if (row.message_id === messageId && !row.is_read) {
            if (!byId) byId = new Map(state.byId)
            byId.set(name, { ...row, is_read: 1 })
        }
    }
    if (!byId) return state
    return { ...state, byId }
}

/** Flip is_read=1 on every row. Same ref if all already read. */
export const patchAllRead = (state: NotificationListState): NotificationListState => {
    let byId: Map<string, NotificationObject> | null = null
    for (const [name, row] of state.byId) {
        if (!row.is_read) {
            if (!byId) byId = new Map(state.byId)
            byId.set(name, { ...row, is_read: 1 })
        }
    }
    if (!byId) return state
    return { ...state, byId }
}

export const beginPagination = (state: NotificationListState): NotificationListState =>
    state.loadingMore ? state : { ...state, loadingMore: true }

export const endPagination = (state: NotificationListState): NotificationListState =>
    state.loadingMore ? { ...state, loadingMore: false } : state
