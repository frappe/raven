import type { NotificationListState, NotificationObject, NotificationTab } from "./reducers"

/**
 * Render list for the notifications page, derived from the single merged window.
 * The base (full, newest-first) array is WeakMap-memoized on the state object, so
 * the unfiltered "all" view returns a stable reference until the feed actually
 * changes; row identities are stable (the store reuses row objects until a row is
 * patched), so virtualized rows only re-render when their own row changed.
 *
 * `type` picks the tab (mention/reaction are subsets of all → client filter, no
 * API call); `unreadOnly` is the unread toggle. Both filter the same window.
 */
const baseCache = new WeakMap<NotificationListState, NotificationObject[]>()

const baseRows = (state: NotificationListState): NotificationObject[] => {
    const cached = baseCache.get(state)
    if (cached) return cached
    const rows: NotificationObject[] = []
    for (const id of state.order) {
        const row = state.byId.get(id)
        if (row) rows.push(row)
    }
    baseCache.set(state, rows)
    return rows
}

export const selectNotificationRows = (
    state: NotificationListState,
    { type, unreadOnly }: { type: NotificationTab; unreadOnly: boolean },
): NotificationObject[] => {
    const base = baseRows(state)
    if (type === "all" && !unreadOnly) return base
    return base.filter(
        (n) => (type === "all" || n.notification_type === type) && (!unreadOnly || !n.is_read),
    )
}
