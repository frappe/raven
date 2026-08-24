import { describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import {
    applyInitialPage,
    applyNewerPage,
    applyOlderPage,
    patchMessage,
    removeMessage,
    upsertMessage,
} from "./reducers"
import { ChannelMessagesState, MAX_WINDOW_SIZE, initialChannelState } from "./types"

/** Builds a minimal text message; `at` is minutes past a fixed base time. */
const msg = (name: string, at: number, overrides: Partial<Message> = {}): Message => {
    const minutes = String(at % 60).padStart(2, "0")
    const hours = String(10 + Math.floor(at / 60)).padStart(2, "0")
    return {
        name,
        owner: "alice",
        _liked_by: "",
        channel_id: "ch-1",
        creation: `2026-06-10 ${hours}:${minutes}:00.000000`,
        modified: `2026-06-10 ${hours}:${minutes}:00.000000`,
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

const readyState = (messages: Message[], flags: Partial<ChannelMessagesState> = {}) => {
    return { ...applyInitialPage(initialChannelState, { messages }), ...flags }
}

describe("applyInitialPage", () => {
    it("sorts messages ascending by creation regardless of input order", () => {
        const state = applyInitialPage(initialChannelState, {
            messages: [msg("c", 3), msg("a", 1), msg("b", 2)],
            has_old_messages: true,
        })
        expect(state.order).toEqual(["a", "b", "c"])
        expect(state.hasOlderMessages).toBe(true)
        expect(state.hasNewerMessages).toBe(false)
        expect(state.status).toBe("ready")
    })

    it("breaks creation-time ties by name for a stable order", () => {
        const state = applyInitialPage(initialChannelState, {
            messages: [msg("b", 1), msg("a", 1)],
        })
        expect(state.order).toEqual(["a", "b"])
    })
})

describe("upsertMessage", () => {
    it("inserts a new message in order at the live edge", () => {
        const state = readyState([msg("a", 1), msg("c", 3)])
        const next = upsertMessage(state, msg("b", 2))
        expect(next.order).toEqual(["a", "b", "c"])
    })

    it("is idempotent: the same message twice returns the same state reference", () => {
        const state = readyState([msg("a", 1)])
        const incoming = msg("a", 1)
        const once = upsertMessage(state, incoming)
        expect(upsertMessage(once, incoming)).toBe(once)
    })

    it("is monotonic: a staler version never overwrites a newer one", () => {
        const newer = msg("a", 1, { modified: "2026-06-10 12:00:00.000000", text: "edited" })
        const state = readyState([newer])
        const stale = msg("a", 1, { modified: "2026-06-10 11:00:00.000000", text: "original" })
        expect(upsertMessage(state, stale)).toBe(state)
    })

    it("ignores new messages while detached from the live edge", () => {
        const state = readyState([msg("a", 1)], { hasNewerMessages: true })
        expect(upsertMessage(state, msg("b", 2))).toBe(state)
    })

    it("still updates an existing message while detached", () => {
        const state = readyState([msg("a", 1)], { hasNewerMessages: true })
        const edited = msg("a", 1, { modified: "2026-06-10 12:00:00.000000", text: "edited" })
        const next = upsertMessage(state, edited)
        expect(next.byId.get("a")?.text).toBe("edited")
    })

    it("preserves object identity of untouched messages", () => {
        const a = msg("a", 1)
        const state = readyState([a])
        const next = upsertMessage(state, msg("b", 2))
        expect(next.byId.get("a")).toBe(state.byId.get("a"))
    })

    it("trims the oldest message and flips hasOlderMessages at the window cap", () => {
        const messages = Array.from({ length: MAX_WINDOW_SIZE }, (_, i) => msg(`m${i}`, i))
        const state = readyState(messages)
        const next = upsertMessage(state, msg("new", MAX_WINDOW_SIZE))
        expect(next.order.length).toBe(MAX_WINDOW_SIZE)
        expect(next.order[0]).toBe("m1")
        expect(next.hasOlderMessages).toBe(true)
        expect(next.byId.has("m0")).toBe(false)
    })
})

describe("patchMessage", () => {
    it("merges a partial update into an existing message", () => {
        const state = readyState([msg("a", 1)])
        const next = patchMessage(state, "a", { text: "edited", is_edited: 1 })
        expect(next.byId.get("a")?.text).toBe("edited")
        expect(next.byId.get("a")?.is_edited).toBe(1)
    })

    it("is a no-op for unknown ids (edit-before-create ordering)", () => {
        const state = readyState([msg("a", 1)])
        expect(patchMessage(state, "ghost", { text: "boo" })).toBe(state)
    })

    it("rejects a patch with a stale modified timestamp", () => {
        const state = readyState([msg("a", 1, { modified: "2026-06-10 12:00:00.000000" })])
        const next = patchMessage(state, "a", { text: "old", modified: "2026-06-10 11:00:00.000000" })
        expect(next).toBe(state)
    })
})

describe("removeMessage", () => {
    it("removes a message from byId and order", () => {
        const state = readyState([msg("a", 1), msg("b", 2)])
        const next = removeMessage(state, "a")
        expect(next.order).toEqual(["b"])
        expect(next.byId.has("a")).toBe(false)
    })

    it("is a no-op for unknown ids", () => {
        const state = readyState([msg("a", 1)])
        expect(removeMessage(state, "ghost")).toBe(state)
    })
})

describe("pagination pages", () => {
    it("applyOlderPage merges below and updates hasOlderMessages from the response", () => {
        const state = readyState([msg("c", 3)], { hasOlderMessages: true })
        const next = applyOlderPage(state, {
            messages: [msg("a", 1), msg("b", 2)],
            has_old_messages: false,
        })
        expect(next.order).toEqual(["a", "b", "c"])
        expect(next.hasOlderMessages).toBe(false)
    })

    it("applyNewerPage merges above and updates hasNewerMessages from the response", () => {
        const state = readyState([msg("a", 1)], { hasNewerMessages: true })
        const next = applyNewerPage(state, {
            messages: [msg("b", 2)],
            has_new_messages: false,
        })
        expect(next.order).toEqual(["a", "b"])
        expect(next.hasNewerMessages).toBe(false)
    })

    it("deduplicates overlapping pages", () => {
        const state = readyState([msg("b", 2), msg("c", 3)])
        const next = applyOlderPage(state, { messages: [msg("a", 1), msg("b", 2)] })
        expect(next.order).toEqual(["a", "b", "c"])
    })

    it("applyOlderPage detaches from the live edge when trimming the newest end", () => {
        const messages = Array.from({ length: MAX_WINDOW_SIZE }, (_, i) => msg(`m${i + 50}`, i + 50))
        const state = readyState(messages, { hasOlderMessages: true })
        const olderPage = Array.from({ length: 30 }, (_, i) => msg(`old${i}`, i))
        const next = applyOlderPage(state, { messages: olderPage, has_old_messages: true })
        expect(next.order.length).toBe(MAX_WINDOW_SIZE)
        expect(next.hasNewerMessages).toBe(true)
        expect(next.order[0]).toBe("old0")
    })
})
