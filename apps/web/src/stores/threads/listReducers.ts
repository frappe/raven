import type { ThreadMessage } from "src/types/ThreadMessage"

export type ThreadTab = "participating" | "other" | "ai"

/** One tab's (or detached search view's) paginated thread window. */
export type ThreadListState = {
    status: "idle" | "loading" | "ready" | "error"
    error: string | null
    /** id → row. References stable unless that row changed. */
    byId: ReadonlyMap<string, ThreadMessage>
    /** Thread ids sorted DESC by last_message_timestamp (index 0 = most recent). */
    order: readonly string[]
    hasMore: boolean
    loadingMore: boolean
}

export const initialThreadListState: ThreadListState = {
    status: "idle",
    error: null,
    byId: new Map(),
    order: [],
    hasMore: false,
    loadingMore: false,
}

/**
 * Descending comparator on last_message_timestamp. Frappe emits fixed-width
 * `YYYY-MM-DD HH:MM:SS.ffffff`, so lexicographic order == chronological — no Date parse.
 * Ties break on name (descending) for a stable, deterministic order.
 */
const sortedOrder = (byId: ReadonlyMap<string, ThreadMessage>): string[] =>
    [...byId.keys()].sort((a, b) => {
        const ta = byId.get(a)?.last_message_timestamp ?? ""
        const tb = byId.get(b)?.last_message_timestamp ?? ""
        if (ta !== tb) return ta < tb ? 1 : -1
        return a < b ? 1 : -1
    })

export const markLoading = (state: ThreadListState): ThreadListState =>
    state.status === "loading" ? state : { ...state, status: "loading", error: null }

export const markError = (state: ThreadListState, error: string): ThreadListState => ({
    ...state,
    status: "error",
    error,
    loadingMore: false,
})

/** Replace the window — initial load, tab switch, or search snapshot. */
export const applyInitialPage = (
    state: ThreadListState,
    rows: ThreadMessage[],
    hasMore: boolean,
): ThreadListState => {
    const byId = new Map<string, ThreadMessage>()
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
 * Upsert rows into the existing window and re-sort, keeping already-loaded ids.
 * Used for pagination (append) AND first-page reconcile after a live event.
 * Same reference when no row was added or changed.
 */
export const mergePage = (
    state: ThreadListState,
    rows: ThreadMessage[],
    hasMore: boolean,
): ThreadListState => {
    if (rows.length === 0) {
        return state.hasMore === hasMore && !state.loadingMore
            ? state
            : { ...state, status: "ready", hasMore, loadingMore: false }
    }
    const byId = new Map(state.byId)
    let changed = false
    for (const r of rows) {
        const prev = byId.get(r.name)
        if (
            !prev ||
            prev.last_message_timestamp !== r.last_message_timestamp ||
            prev.reply_count !== r.reply_count
        ) {
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

/**
 * A new reply advanced a thread's timestamp — patch it and re-sort it to the top. The reply
 * COUNT isn't touched here: the list reads it from threadMetaStore (live via thread_reply),
 * so this reducer only owns ORDER. No-op when not strictly newer.
 */
export const bumpThread = (
    state: ThreadListState,
    threadID: string,
    lastMessageTimestamp: string,
): ThreadListState => {
    const existing = state.byId.get(threadID)
    if (!existing) return state
    if (existing.last_message_timestamp >= lastMessageTimestamp) return state
    const byId = new Map(state.byId)
    byId.set(threadID, { ...existing, last_message_timestamp: lastMessageTimestamp })
    return { ...state, byId, order: sortedOrder(byId) }
}

export const removeThread = (state: ThreadListState, threadID: string): ThreadListState => {
    if (!state.byId.has(threadID)) return state
    const byId = new Map(state.byId)
    byId.delete(threadID)
    return { ...state, byId, order: state.order.filter((id) => id !== threadID) }
}

export const beginPagination = (state: ThreadListState): ThreadListState =>
    state.loadingMore ? state : { ...state, loadingMore: true }

export const endPagination = (state: ThreadListState): ThreadListState =>
    state.loadingMore ? { ...state, loadingMore: false } : state
