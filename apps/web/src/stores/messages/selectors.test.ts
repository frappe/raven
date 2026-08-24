import { describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { applyInitialPage, upsertMessage } from "./reducers"
import { selectStreamBlocks } from "./selectors"
import { initialChannelState } from "./types"

const msg = (name: string, creation: string, overrides: Partial<Message> = {}): Message => {
    return {
        name,
        owner: "alice",
        _liked_by: "",
        channel_id: "ch-1",
        creation,
        modified: creation,
        message_type: "Text",
        text: `message ${name}`,
        is_continuation: 0,
        is_reply: 0,
        is_edited: 0,
        is_forwarded: 0,
        is_thread: 0,
        is_pinned: 0,
        ...overrides,
    } as Message
}

const stateOf = (messages: Message[]) => applyInitialPage(initialChannelState, { messages })

describe("selectStreamBlocks", () => {
    it("inserts a date divider before each day's first message", () => {
        const state = stateOf([
            msg("a", "2026-06-09 10:00:00.000000"),
            msg("b", "2026-06-10 09:00:00.000000"),
        ])
        const blocks = selectStreamBlocks(state)
        expect(blocks.map((b) => b.message_type)).toEqual(["date", "Text", "date", "Text"])
    })

    it("marks messages from the same sender within 2 minutes as continuations", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000"),
            msg("b", "2026-06-10 10:01:00.000000"),
            msg("c", "2026-06-10 10:05:00.000000"),
        ])
        const [, first, second, third] = selectStreamBlocks(state) as Message[]
        expect(first.is_continuation).toBe(0)
        expect(second.is_continuation).toBe(1)
        expect(third.is_continuation).toBe(0)
    })

    it("breaks continuation on sender change, system messages, and day boundaries", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000"),
            msg("b", "2026-06-10 10:01:00.000000", { owner: "bob" }),
            msg("c", "2026-06-10 23:59:30.000000", { owner: "bob" }),
            msg("d", "2026-06-11 00:00:30.000000", { owner: "bob" }),
        ])
        const blocks = selectStreamBlocks(state)
        const byName = Object.fromEntries(
            blocks.filter((b): b is Message => b.message_type !== "date").map((b) => [b.name, b]),
        )
        expect(byName["b"].is_continuation).toBe(0) // sender changed
        expect(byName["d"].is_continuation).toBe(0) // new day, despite 60s gap
    })

    it("treats a thread parent as a continuation boundary in both directions", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000"),
            msg("b", "2026-06-10 10:00:30.000000", { is_thread: 1 }),
            msg("c", "2026-06-10 10:01:00.000000"),
        ])
        const [, first, thread, after] = selectStreamBlocks(state) as Message[]
        expect(first.is_continuation).toBe(0)
        expect(thread.is_continuation).toBe(0) // thread parent never continues
        expect(after.is_continuation).toBe(0) // nothing continues from a thread parent
    })

    it("distinguishes bots from their owner user when grouping", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000"),
            msg("b", "2026-06-10 10:01:00.000000", { is_bot_message: 1, bot: "helper-bot" }),
        ])
        const blocks = selectStreamBlocks(state) as Message[]
        expect(blocks[2].is_continuation).toBe(0)
    })

    it("flags pinned messages from the pinned string", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000"),
            msg("b", "2026-06-10 10:10:00.000000"),
        ])
        const blocks = selectStreamBlocks(state, "a\n") as Message[]
        expect(blocks[1].is_pinned).toBe(1)
        expect(blocks[2].is_pinned).toBe(0)
    })

    it("memoizes: same state and pinned string return the same array reference", () => {
        const state = stateOf([msg("a", "2026-06-10 10:00:00.000000")])
        expect(selectStreamBlocks(state, "")).toBe(selectStreamBlocks(state, ""))
    })

    it("treats a null pinned string (channel with no pins) as no pins", () => {
        const state = stateOf([msg("a", "2026-06-10 10:00:00.000000")])
        const blocks = selectStreamBlocks(state, null) as Message[]
        expect(blocks[1].is_pinned).toBe(0)
        // null and "" normalize to the same cache entry
        expect(selectStreamBlocks(state, null)).toBe(selectStreamBlocks(state, ""))
    })

    it("groups consecutive messages sharing a batch id into one batch block", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000", { message_batch_id: "b1", message_type: "Image" }),
            msg("b", "2026-06-10 10:00:01.000000", { message_batch_id: "b1", message_type: "Image" }),
            msg("c", "2026-06-10 10:00:02.000000", { message_batch_id: "b1", message_type: "Image" }),
            msg("d", "2026-06-10 10:05:00.000000"),
        ])
        const blocks = selectStreamBlocks(state)
        expect(blocks.map((b) => b.message_type)).toEqual(["date", "batch", "Text"])
        const batch = blocks[1] as Extract<(typeof blocks)[number], { message_type: "batch" }>
        expect(batch.messages.map((m) => m.name)).toEqual(["a", "b", "c"])
        // 'd' continues from the batch's LAST member (1 min earlier? no — 5 min gap → not continuation)
        expect((blocks[2] as Message).is_continuation).toBe(0)
    })

    it("marks a message following a batch as continuation relative to the batch's last member", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000", { message_batch_id: "b1" }),
            msg("b", "2026-06-10 10:00:01.000000", { message_batch_id: "b1" }),
            msg("c", "2026-06-10 10:01:00.000000"),
        ])
        const blocks = selectStreamBlocks(state)
        expect((blocks[2] as Message).is_continuation).toBe(1)
    })

    it("does not group messages without batch ids or with different batch ids", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000"),
            msg("b", "2026-06-10 10:00:01.000000"),
            msg("c", "2026-06-10 10:00:02.000000", { message_batch_id: "b1" }),
            msg("d", "2026-06-10 10:00:03.000000", { message_batch_id: "b2" }),
        ])
        const blocks = selectStreamBlocks(state)
        // No batch blocks: a+b have no ids, c and d are single-member batches
        expect(blocks.filter((b) => b.message_type === "batch")).toEqual([])
        expect(blocks.length).toBe(5) // date + 4 messages
    })

    it("keeps a single thread parent inside the batch (stays grouped)", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000", { message_batch_id: "b1", message_type: "Image", is_thread: 1 }),
            msg("b", "2026-06-10 10:00:01.000000", { message_batch_id: "b1", message_type: "Image" }),
            msg("c", "2026-06-10 10:00:02.000000", { message_batch_id: "b1", message_type: "Image" }),
        ])
        const blocks = selectStreamBlocks(state)
        expect(blocks.map((b) => b.message_type)).toEqual(["date", "batch"])
        const batch = blocks[1] as Extract<(typeof blocks)[number], { message_type: "batch" }>
        expect(batch.messages.map((m) => m.name)).toEqual(["a", "b", "c"])
    })

    it("splits a batch into individual messages when 2+ members are threads", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000", { message_batch_id: "b1", message_type: "Image" }),
            msg("b", "2026-06-10 10:00:01.000000", { message_batch_id: "b1", message_type: "Image", is_thread: 1 }),
            msg("c", "2026-06-10 10:00:02.000000", { message_batch_id: "b1", message_type: "Image", is_thread: 1 }),
        ])
        const blocks = selectStreamBlocks(state)
        // No batch — each renders individually so every thread pill is visible
        expect(blocks.map((b) => b.message_type)).toEqual(["date", "Image", "Image", "Image"])
        expect((blocks.slice(1) as Message[]).map((m) => m.name)).toEqual(["a", "b", "c"])
    })

    it("breaks a batch when another sender's message interleaves", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000", { message_batch_id: "b1" }),
            msg("x", "2026-06-10 10:00:01.000000", { owner: "bob" }),
            msg("b", "2026-06-10 10:00:02.000000", { message_batch_id: "b1" }),
        ])
        const blocks = selectStreamBlocks(state)
        // Two separate fragments around the interloper, neither big enough to batch
        expect(blocks.filter((b) => b.message_type === "batch")).toEqual([])
    })

    it("preserves block identity for unchanged messages across state changes", () => {
        const state = stateOf([
            msg("a", "2026-06-10 10:00:00.000000"),
            msg("b", "2026-06-10 11:00:00.000000", { owner: "bob" }),
        ])
        const before = selectStreamBlocks(state)
        const next = upsertMessage(state, msg("c", "2026-06-10 12:00:00.000000", { owner: "carol" }))
        const after = selectStreamBlocks(next)
        const blockA = (blocks: typeof before) =>
            blocks.find((b) => b.message_type !== "date" && b.name === "a")
        expect(blockA(after)).toBe(blockA(before))
    })
})
