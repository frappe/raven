import { beforeEach, describe, expect, it } from "vitest"
import type { Message } from "@raven/types/common/Message"
import { bumpConnectionEpoch } from "@stores/connectionFreshness"
import { reconcileStaleWindow, type FrappeCallClient } from "./loaders"
import { channelMessagesStore } from "./store"
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

/** A live-edge window of `size` messages in a fresh channel. Never stamped, so it is stale. */
const seedWindow = (size: number) => {
    const channelID = `ch-${++channelCounter}`
    const messages = Array.from({ length: size }, (_, i) => msg(`m${i}`, i))
    channelMessagesStore.setInitialPage(channelID, { messages })
    return channelID
}

/** Records every call; answers each with an empty page. */
const fakeClient = () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = []
    const client: FrappeCallClient = {
        get: async (method, params) => {
            calls.push({ method, params })
            return { message: { messages: [] } } as never
        },
    }
    return { client, calls }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("reconcileStaleWindow", () => {
    beforeEach(() => bumpConnectionEpoch())

    it("replaces a shallow window with a full refetch", async () => {
        const channelID = seedWindow(20)
        const { client, calls } = fakeClient()
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls.map((call) => call.method)).toEqual(["raven.api.chat_stream.get_messages"])
    })

    it("catches a deep window up with only the newer messages", async () => {
        const channelID = seedWindow(120)
        const { client, calls } = fakeClient()
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls.map((call) => call.method)).toEqual(["raven.api.chat_stream.get_newer_messages"])
        expect(calls[0].params).toMatchObject({ from_message: "m119", limit: 100 })
    })

    it("never asks for more than the window can hold", async () => {
        const channelID = seedWindow(MAX_WINDOW_SIZE - 40)
        const { client, calls } = fakeClient()
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls[0].params).toMatchObject({ limit: 40 })
    })

    it("skips the catch-up for a full window", async () => {
        const channelID = seedWindow(MAX_WINDOW_SIZE)
        const { client, calls } = fakeClient()
        await reconcileStaleWindow(client, channelID)
        await flush()
        expect(calls).toEqual([])
    })
})
