import { beforeEach, describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { bumpConnectionEpoch, isWindowStale } from "@stores/connectionFreshness"
import { reconcileStaleWindow, type FrappeCallClient } from "./loaders"
import { channelMessagesStore } from "./store"
import { channelUnreadStore } from "@stores/unread/store"
import { MAX_WINDOW_SIZE } from "./types"

let channelCounter = 0

/** Builds a minimal text message; `at` is seconds past a fixed base time. */
const msg = (name: string, at: number): Message => {
    const minutes = String(Math.floor(at / 60) % 60).padStart(2, "0")
    const seconds = String(at % 60).padStart(2, "0")
    return {
        name,
        owner: "alice",
        channel_id: "ch",
        creation: `2026-06-10 10:${minutes}:${seconds}.000000`,
        modified: `2026-06-10 10:${minutes}:${seconds}.000000`,
        message_type: "Text",
        text: name,
    } as Message
}

/** A live-edge window of `size` messages in a fresh channel, starting ten minutes in so
 *  older history fits before it. Never stamped, so it is stale. */
const seedWindow = (size: number) => {
    const channelID = `ch-${++channelCounter}`
    const messages = Array.from({ length: size }, (_, i) => msg(`m${i}`, 600 + i))
    channelMessagesStore.setInitialPage(channelID, { messages })
    return channelID
}

/** Records every call; answers with the window's own messages, or rejects while `failing`. */
const fakeClient = () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = []
    const state = { failing: false, reply: [] as Message[], lastVisit: undefined as string | undefined }
    const client: FrappeCallClient = {
        get: async (method, params) => {
            calls.push({ method, params })
            if (state.failing) throw new Error("offline")
            return { message: { messages: state.reply, last_visit: state.lastVisit } } as never
        },
    }
    return { client, calls, state }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("reconcileStaleWindow", () => {
    beforeEach(() => bumpConnectionEpoch())

    it("refreshes the window's own span from its oldest message", async () => {
        const channelID = seedWindow(120)
        const { client, calls, state } = fakeClient()
        state.reply = [msg("m0", 0)]
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls.map((call) => call.method)).toEqual(["raven.api.chat_stream.get_newer_messages"])
        expect(calls[0].params).toMatchObject({ from_message: "m0", include_from_message: true, limit: MAX_WINDOW_SIZE })
    })

    it("leaves room for sends still in flight", async () => {
        const channelID = seedWindow(20)
        channelMessagesStore.addOptimisticMessages(channelID, "batch-1", [
            { ...msg("tmp", 900), _status: "sending" } as never,
        ])
        const { client, calls, state } = fakeClient()
        state.reply = [msg("m0", 600)]
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls[0].params).toMatchObject({ limit: MAX_WINDOW_SIZE - 1 })
    })

    it("adopts the server's read watermark, so a read on another device moves the divider", async () => {
        const channelID = seedWindow(20)
        const { client, state } = fakeClient()
        state.reply = [msg("m0", 600)]
        state.lastVisit = "2026-06-10 10:15:00.000000"
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(channelUnreadStore.getServerWatermark(channelID)).toBe("2026-06-10 10:15:00.000000")
    })

    it("marks the window fresh, so the next check costs nothing", async () => {
        const channelID = seedWindow(20)
        const { client, calls, state } = fakeClient()
        state.reply = [msg("m0", 0)]
        await reconcileStaleWindow(client, channelID)
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls).toHaveLength(1)
    })

    it("stays stale after a failure and retries from the same message", async () => {
        const channelID = seedWindow(20)
        const { client, calls, state } = fakeClient()
        state.failing = true
        await reconcileStaleWindow(client, channelID)
        channelMessagesStore.messageCreated(channelID, msg("live", 900))
        state.failing = false
        state.reply = [msg("m0", 0)]
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls.map((call) => call.params?.from_message)).toEqual(["m0", "m0"])
    })

    it("discards the response when older history loaded during the request", async () => {
        const channelID = seedWindow(20)
        const calls: Record<string, unknown>[] = []
        let answer: (page: unknown) => void = () => {}
        const client: FrappeCallClient = {
            get: <T,>(_method: string, params?: Record<string, unknown>) => {
                calls.push(params ?? {})
                return new Promise<T>((resolve) => { answer = resolve as (page: unknown) => void })
            },
        }
        const pending = reconcileStaleWindow(client, channelID)
        channelMessagesStore.setOlderPage(channelID, { messages: [msg("old", 100)] })
        answer({ message: { messages: [msg("m0", 600)] } })
        await pending
        await flush()
        const state = channelMessagesStore.getState(channelID)
        expect(state.order[0]).toBe("old")
        expect(state.order).toHaveLength(21)
        expect(isWindowStale(channelID)).toBe(true)
    })

    it("drops an oldest message the server no longer has and retries from the next", async () => {
        const channelID = seedWindow(20)
        const { client, calls, state } = fakeClient()
        state.reply = []
        await reconcileStaleWindow(client, channelID)
        await flush()
        // An empty span means m0 was deleted during the gap; m1 anchors the retry.
        expect(calls.map((call) => call.params?.from_message).slice(0, 2)).toEqual(["m0", "m1"])
        expect(channelMessagesStore.getState(channelID).byId.has("m0")).toBe(false)
    })
})
