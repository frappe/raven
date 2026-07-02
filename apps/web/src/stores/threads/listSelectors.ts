import type { ThreadMessage } from "src/types/ThreadMessage"
import { ThreadListState } from "./listReducers"

/** A thread row decorated with its live unread flag for the list to render. */
export type ThreadRowData = ThreadMessage & { _isUnread: boolean }

type Options = {
    channelFilter?: string
    onlyShowUnread: boolean
    unreadSet: ReadonlySet<string>
}

type CacheEntry = {
    channelFilter?: string
    onlyShowUnread: boolean
    unreadSet: ReadonlySet<string>
    rows: ThreadRowData[]
}

/**
 * One cached result per state object. State objects are immutable, so "same state
 * reference + same filter inputs" safely means "return the previous array". Keyed
 * weakly so old state snapshots and their row arrays are garbage-collected.
 */
const cache = new WeakMap<ThreadListState, CacheEntry>()

/**
 * Remembers the decorated copy produced for each thread, so a row whose unread flag
 * didn't change keeps its object identity across selector runs — and a row whose flag
 * DID change gets a new object. That identity is what makes the virtualized list
 * re-render exactly the rows whose unread state flipped (the dot) and skip the rest;
 * unread state lives in a store, not on the row, so without baking it into the row
 * data the list never sees it change. WeakMap so evicted threads don't leak.
 */
const decorationCache = new WeakMap<ThreadMessage, { isUnread: boolean; row: ThreadRowData }>()

const decorate = (thread: ThreadMessage, isUnread: boolean): ThreadRowData => {
    const cached = decorationCache.get(thread)
    if (cached && cached.isUnread === isUnread) return cached.row
    const row: ThreadRowData = { ...thread, _isUnread: isUnread }
    decorationCache.set(thread, { isUnread, row })
    return row
}

/**
 * Rows for render: store order (already sorted desc by timestamp), client-side channel
 * + unread filters applied, each decorated with its live `_isUnread` flag. Channel data
 * and the unread set live in stores, so this stays live without a refetch.
 */
export const selectThreadRows = (state: ThreadListState, opts: Options): ThreadRowData[] => {
    const { channelFilter, onlyShowUnread, unreadSet } = opts
    const cached = cache.get(state)
    if (
        cached &&
        cached.channelFilter === channelFilter &&
        cached.onlyShowUnread === onlyShowUnread &&
        cached.unreadSet === unreadSet
    ) {
        return cached.rows
    }
    const rows: ThreadRowData[] = []
    for (const id of state.order) {
        const row = state.byId.get(id)
        if (!row) continue
        if (channelFilter && channelFilter !== "*all" && row.channel_id !== channelFilter) continue
        const isUnread = unreadSet.has(id)
        if (onlyShowUnread && !isUnread) continue
        rows.push(decorate(row, isUnread))
    }
    cache.set(state, { channelFilter, onlyShowUnread, unreadSet, rows })
    return rows
}
