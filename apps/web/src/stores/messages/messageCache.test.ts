import { describe, expect, it, vi } from "vitest"
import type { Message } from "@raven/types/common/Message"

const { bulkPut } = vi.hoisted(() => ({ bulkPut: vi.fn(async (_windows: unknown) => {}) }))
vi.mock("@db", () => ({ db: { message_windows: { bulkPut } } }))
vi.mock("@lib/offline", () => ({ offlineCacheEnabled: () => true }))

import { CACHE_WINDOW, enableMessageCache, pageFromRows, persistWindow, rowsToPersist } from "./messageCache"
import { channelMessagesStore } from "./store"
import { initialChannelState, type ChannelMessagesState } from "./types"

const message = (i: number, extra: Partial<Message> = {}): Message =>
    ({ name: `m${i}`, channel_id: "c", creation: `2026-09-11 10:00:${String(i).padStart(2, "0")}.000000`, message_type: "Text", ...extra }) as Message

const ready = (count: number, overrides: Partial<ChannelMessagesState> = {}): ChannelMessagesState => {
    const messages = Array.from({ length: count }, (_, i) => message(i))
    return { ...initialChannelState, status: "ready", byId: new Map(messages.map((m) => [m.name, m])), order: messages.map((m) => m.name), ...overrides }
}

describe("rowsToPersist", () => {
    it("keeps the newest CACHE_WINDOW messages in order", () => {
        const rows = rowsToPersist(ready(30))!
        expect(rows).toHaveLength(CACHE_WINDOW)
        expect(rows[0].name).toBe("m10")
        expect(rows[rows.length - 1].name).toBe("m29")
    })
    it("skips unconfirmed sends", () => {
        const state = ready(3)
        const optimistic = message(9, { _status: "sending" } as Partial<Message>)
        state.byId = new Map([...state.byId, [optimistic.name, optimistic]])
        state.order = [...state.order, optimistic.name]
        expect(rowsToPersist(state)!.map((m) => m.name)).toEqual(["m0", "m1", "m2"])
    })
    it("refuses a loading window and a window scrolled away from the live edge", () => {
        expect(rowsToPersist({ ...initialChannelState, status: "loading" })).toBeNull()
        expect(rowsToPersist(ready(5, { hasNewerMessages: true }))).toBeNull()
    })
})

describe("pageFromRows", () => {
    it("marks history as available above and none below", () => {
        expect(pageFromRows([message(1)])).toEqual({ messages: [message(1)], has_old_messages: true, has_new_messages: false })
    })
})

describe("enableMessageCache", () => {
    it("installs the write-through on the store", () => {
        enableMessageCache()
        expect(channelMessagesStore.onChange).toBe(persistWindow)
    })
})

describe("persistWindow", () => {
    it("writes once per second and skips windows whose rows did not change", async () => {
        vi.useFakeTimers()
        const state = ready(3)
        persistWindow("c", state)
        persistWindow("c", { ...state, loadingOlder: true })
        await vi.advanceTimersByTimeAsync(1000)
        expect(bulkPut).toHaveBeenCalledTimes(1)
        expect(bulkPut.mock.calls[0][0]).toEqual([{ channel_id: "c", rows: state.order.map((name) => state.byId.get(name)) }])
        persistWindow("c", { ...state, loadingOlder: false })
        await vi.advanceTimersByTimeAsync(1000)
        expect(bulkPut).toHaveBeenCalledTimes(1)
        vi.useRealTimers()
    })
    it("retries a window after a failed write", async () => {
        vi.useFakeTimers()
        const state = ready(2)
        bulkPut.mockRejectedValueOnce(new Error("quota"))
        persistWindow("d", state)
        await vi.advanceTimersByTimeAsync(1000)
        persistWindow("d", state)
        await vi.advanceTimersByTimeAsync(1000)
        expect(bulkPut.mock.calls.filter(([w]) => (w as { channel_id: string }[])[0].channel_id === "d")).toHaveLength(2)
        vi.useRealTimers()
    })
})
