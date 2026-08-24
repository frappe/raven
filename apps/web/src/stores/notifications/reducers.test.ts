import { describe, expect, it } from "vitest"
import {
    applyInitialPage,
    initialNotificationListState,
    markLoading,
    mergePage,
    patchAllRead,
    patchRead,
    type NotificationObject,
} from "./reducers"

const n = (
    name: string,
    creation: string,
    overrides: Partial<NotificationObject> = {},
): NotificationObject => ({
    name,
    notification_type: "mention",
    is_read: 0,
    message_id: overrides.message_id ?? "msg-" + name,
    channel_id: "ch1",
    owner: "u@a.com",
    creation,
    text: "t",
    content: "c",
    message_type: "Text",
    channel_type: "Public",
    channel_name: "general",
    is_thread: 0,
    is_direct_message: 0,
    ...overrides,
})

describe("notification reducers", () => {
    it("applyInitialPage builds byId + DESC order and marks ready", () => {
        const next = applyInitialPage(initialNotificationListState, [
            n("a", "2026-06-26 10:00:00.000000"),
            n("b", "2026-06-26 12:00:00.000000"),
        ], true)
        expect(next.status).toBe("ready")
        expect(next.order).toEqual(["b", "a"])
        expect(next.hasMore).toBe(true)
    })

    it("mergePage upserts + re-sorts and is a no-op (same ref) for already-present unchanged rows", () => {
        const base = applyInitialPage(initialNotificationListState, [n("a", "2026-06-26 10:00:00.000000")], false)
        const same = mergePage(base, [n("a", "2026-06-26 10:00:00.000000")], false)
        expect(same).toBe(base)
        const merged = mergePage(base, [n("b", "2026-06-26 11:00:00.000000")], false)
        expect(merged.order).toEqual(["b", "a"])
    })

    it("mergePage with empty rows but a hasMore change updates flags; identical flags no-op", () => {
        const base = applyInitialPage(initialNotificationListState, [n("a", "2026-06-26 10:00:00.000000")], true)
        expect(mergePage(base, [], true)).toBe(base)
        expect(mergePage(base, [], false).hasMore).toBe(false)
    })

    it("patchRead flips is_read on every row matching message_id; same ref when none match", () => {
        const base = applyInitialPage(initialNotificationListState, [
            n("a", "2026-06-26 10:00:00.000000", { message_id: "m1" }),
            n("b", "2026-06-26 11:00:00.000000", { message_id: "m1" }),
            n("c", "2026-06-26 12:00:00.000000", { message_id: "m2" }),
        ], false)
        const next = patchRead(base, "m1")
        expect(next.byId.get("a")?.is_read).toBe(1)
        expect(next.byId.get("b")?.is_read).toBe(1)
        expect(next.byId.get("c")?.is_read).toBe(0)
        expect(patchRead(next, "m1")).toBe(next) // already read → no-op
        expect(patchRead(base, "nope")).toBe(base) // no match → no-op
    })

    it("patchAllRead flips all rows; same ref when all already read", () => {
        const base = applyInitialPage(initialNotificationListState, [
            n("a", "2026-06-26 10:00:00.000000"),
            n("b", "2026-06-26 11:00:00.000000", { is_read: 1 }),
        ], false)
        const next = patchAllRead(base)
        expect([...next.byId.values()].every((x) => x.is_read === 1)).toBe(true)
        expect(patchAllRead(next)).toBe(next)
    })

    it("markLoading is idempotent when already loading", () => {
        const loading = markLoading(initialNotificationListState)
        expect(markLoading(loading)).toBe(loading)
    })
})
