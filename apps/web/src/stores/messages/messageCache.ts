import { db, type MessageWindow } from "@db"
import { offlineCacheEnabled } from "@lib/offline"
import type { Message } from "@raven/types/common/Message"
import { channelMessagesStore } from "./store"
import { isOptimistic, type ChannelMessagesState, type MessagesPage } from "./types"

/** Messages kept per channel or thread for an offline cold start. */
export const CACHE_WINDOW = 20

/** The newest messages of a ready, live-edge window; null when the window must not be cached. */
export const rowsToPersist = (state: ChannelMessagesState): Message[] | null => {
    if (state.status !== "ready" || state.hasNewerMessages) return null
    const rows: Message[] = []
    for (let i = state.order.length - 1; i >= 0 && rows.length < CACHE_WINDOW; i--) {
        const message = state.byId.get(state.order[i])
        // Unconfirmed sends live in the outbox, which rehydrates them itself.
        if (message && !isOptimistic(message)) rows.push(message)
    }
    return rows.reverse()
}

/** A page for the store from cached rows: history is assumed to exist above it. */
export const pageFromRows = (rows: Message[]): MessagesPage => ({
    messages: rows,
    has_old_messages: true,
    has_new_messages: false,
})

const dirty = new Map<string, ChannelMessagesState>()
const written = new Map<string, Message[]>()
let timer: ReturnType<typeof setTimeout> | undefined
let onFlushed: (() => void) | undefined
/** Native hooks the media trim here; a browser tab never sets it. */
export const setCacheFlushListener = (fn: (() => void) | undefined) => { onFlushed = fn }

// Store messages are immutable, so identical identities mean identical bytes on disk.
const sameRows = (a: Message[] | undefined, b: Message[]) => a?.length === b.length && a.every((m, i) => m === b[i])

const flush = async () => {
    timer = undefined
    const windows: MessageWindow[] = []
    for (const [channel_id, state] of dirty) {
        const rows = rowsToPersist(state)
        if (!rows || sameRows(written.get(channel_id), rows)) continue
        written.set(channel_id, rows)
        windows.push({ channel_id, rows })
    }
    dirty.clear()
    if (!windows.length) return
    try {
        await db.message_windows.bulkPut(windows)
    } catch {
        // Quota or a closed database: forget the attempt so the next change tries again.
        for (const { channel_id } of windows) written.delete(channel_id)
    }
    onFlushed?.()
}

/** Remembers the latest state; one write per second covers every dirty channel. */
export const persistWindow = (channelID: string, state: ChannelMessagesState) => {
    dirty.set(channelID, state)
    timer ??= setTimeout(flush, 1000)
}

/** Hooks the store's writes to the cache; a plain browser tab never pays for the call. */
export const enableMessageCache = () => {
    if (offlineCacheEnabled()) channelMessagesStore.onChange = persistWindow
}

export const readCachedWindow = async (channelID: string): Promise<MessagesPage | null> => {
    if (!offlineCacheEnabled()) return null
    try {
        const rows = (await db.message_windows.get(channelID))?.rows
        return rows?.length ? pageFromRows(rows) : null
    } catch {
        return null
    }
}
