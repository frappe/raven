import { describe, expect, it } from "vitest"
import { applyInitialPage, initialNotificationListState, type NotificationObject } from "./reducers"
import { selectNotificationRows } from "./selectors"

const n = (
    name: string,
    creation: string,
    is_read: 0 | 1,
    notification_type: "mention" | "reaction" = "mention",
): NotificationObject => ({
    name,
    notification_type,
    is_read,
    message_id: "m-" + name,
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
})

describe("selectNotificationRows", () => {
    const state = applyInitialPage(initialNotificationListState, [
        n("a", "2026-06-26 10:00:00.000000", 0, "mention"),
        n("b", "2026-06-26 12:00:00.000000", 1, "reaction"),
        n("c", "2026-06-26 11:00:00.000000", 0, "reaction"),
    ], false)

    it("type 'all' returns rows newest-first", () => {
        expect(selectNotificationRows(state, { type: "all", unreadOnly: false }).map((r) => r.name)).toEqual([
            "b",
            "c",
            "a",
        ])
    })

    it("type 'mention' filters to mention rows", () => {
        expect(selectNotificationRows(state, { type: "mention", unreadOnly: false }).map((r) => r.name)).toEqual([
            "a",
        ])
    })

    it("type 'reaction' filters to reaction rows, newest-first", () => {
        expect(selectNotificationRows(state, { type: "reaction", unreadOnly: false }).map((r) => r.name)).toEqual([
            "b",
            "c",
        ])
    })

    it("unreadOnly filters out read rows (within the type)", () => {
        expect(selectNotificationRows(state, { type: "all", unreadOnly: true }).map((r) => r.name)).toEqual([
            "c",
            "a",
        ])
        expect(selectNotificationRows(state, { type: "reaction", unreadOnly: true }).map((r) => r.name)).toEqual([
            "c",
        ])
    })

    it("returns a stable reference for the unfiltered all view of the same state", () => {
        expect(selectNotificationRows(state, { type: "all", unreadOnly: false })).toBe(
            selectNotificationRows(state, { type: "all", unreadOnly: false }),
        )
    })
})
