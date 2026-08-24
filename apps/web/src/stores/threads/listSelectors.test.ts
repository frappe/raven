import { describe, it, expect } from "vitest"
import type { ThreadMessage } from "src/types/ThreadMessage"
import { applyInitialPage, initialThreadListState } from "./listReducers"
import { selectThreadRows } from "./listSelectors"

const row = (name: string, ts: string, channel_id: string): ThreadMessage =>
    ({ name, last_message_timestamp: ts, channel_id } as ThreadMessage)

const base = applyInitialPage(initialThreadListState, [
    row("a", "2026-06-24 10:00:00.000000", "ch1"),
    row("b", "2026-06-24 12:00:00.000000", "ch2"),
    row("c", "2026-06-24 11:00:00.000000", "ch1"),
], false)

describe("selectThreadRows", () => {
    it("returns all rows in store order when unfiltered", () => {
        const rows = selectThreadRows(base, { onlyShowUnread: false, unreadSet: new Set() })
        expect(rows.map((r) => r.name)).toEqual(["b", "c", "a"])
    })

    it("filters by channel", () => {
        const rows = selectThreadRows(base, { channelFilter: "ch1", onlyShowUnread: false, unreadSet: new Set() })
        expect(rows.map((r) => r.name)).toEqual(["c", "a"])
    })

    it("filters by unread set", () => {
        const rows = selectThreadRows(base, { onlyShowUnread: true, unreadSet: new Set(["b"]) })
        expect(rows.map((r) => r.name)).toEqual(["b"])
    })

    it("returns the same array reference for identical inputs", () => {
        const unreadSet = new Set<string>(["b"])
        const first = selectThreadRows(base, { onlyShowUnread: true, unreadSet })
        const second = selectThreadRows(base, { onlyShowUnread: true, unreadSet })
        expect(second).toBe(first)
    })
})
