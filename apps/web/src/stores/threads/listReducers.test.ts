import { describe, it, expect } from "vitest"
import type { ThreadMessage } from "src/types/ThreadMessage"
import {
    applyInitialPage,
    mergePage,
    bumpThread,
    removeThread,
    beginPagination,
    endPagination,
    initialThreadListState,
} from "./listReducers"

const row = (name: string, ts: string, replyCount = 0): ThreadMessage =>
    ({ name, last_message_timestamp: ts, reply_count: replyCount } as ThreadMessage)

describe("applyInitialPage", () => {
    it("sorts rows descending by last_message_timestamp", () => {
        const next = applyInitialPage(initialThreadListState, [
            row("a", "2026-06-24 10:00:00.000000"),
            row("b", "2026-06-24 12:00:00.000000"),
            row("c", "2026-06-24 11:00:00.000000"),
        ], true)
        expect(next.order).toEqual(["b", "c", "a"])
        expect(next.status).toBe("ready")
        expect(next.hasMore).toBe(true)
    })
})

describe("mergePage", () => {
    it("upserts and re-sorts, keeping already-loaded ids", () => {
        const base = applyInitialPage(initialThreadListState, [
            row("a", "2026-06-24 10:00:00.000000"),
        ], true)
        const next = mergePage(base, [row("b", "2026-06-24 12:00:00.000000")], false)
        expect(next.order).toEqual(["b", "a"])
        expect(next.hasMore).toBe(false)
    })

    it("returns the same reference when nothing changes", () => {
        const base = applyInitialPage(initialThreadListState, [
            row("a", "2026-06-24 10:00:00.000000"),
        ], false)
        const next = mergePage(base, [row("a", "2026-06-24 10:00:00.000000")], false)
        expect(next).toBe(base)
    })
})

describe("bumpThread", () => {
    it("moves a thread to the top when its timestamp advances", () => {
        const base = applyInitialPage(initialThreadListState, [
            row("a", "2026-06-24 10:00:00.000000"),
            row("b", "2026-06-24 12:00:00.000000"),
        ], false)
        const next = bumpThread(base, "a", "2026-06-24 13:00:00.000000")
        expect(next.order).toEqual(["a", "b"])
    })

    it("is a no-op (same ref) for an unknown thread", () => {
        const base = applyInitialPage(initialThreadListState, [row("a", "2026-06-24 10:00:00.000000")], false)
        expect(bumpThread(base, "zzz", "2026-06-24 13:00:00.000000")).toBe(base)
    })

    it("is a no-op (same ref) when the timestamp is not newer", () => {
        const base = applyInitialPage(initialThreadListState, [row("a", "2026-06-24 10:00:00.000000")], false)
        expect(bumpThread(base, "a", "2026-06-24 09:00:00.000000")).toBe(base)
    })
})

describe("removeThread", () => {
    it("drops the thread from byId and order", () => {
        const base = applyInitialPage(initialThreadListState, [
            row("a", "2026-06-24 10:00:00.000000"),
            row("b", "2026-06-24 12:00:00.000000"),
        ], false)
        const next = removeThread(base, "a")
        expect(next.order).toEqual(["b"])
        expect(next.byId.has("a")).toBe(false)
    })

    it("is a no-op (same ref) for an unknown id", () => {
        const base = applyInitialPage(initialThreadListState, [row("a", "2026-06-24 10:00:00.000000")], false)
        expect(removeThread(base, "zzz")).toBe(base)
    })
})

describe("pagination flags", () => {
    it("sets and clears loadingMore", () => {
        const base = applyInitialPage(initialThreadListState, [], true)
        const loading = beginPagination(base)
        expect(loading.loadingMore).toBe(true)
        expect(endPagination(loading).loadingMore).toBe(false)
    })
})
