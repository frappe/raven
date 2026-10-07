import { afterEach, describe, expect, it, vi } from "vitest"
import { threadMetaStore } from "./store"

afterEach(() => vi.useRealTimers())

describe("threadMetaStore.applyFetched", () => {
    it("rejects a fetch that went out before a live reply, even after a newer fetch landed", () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000)
        threadMetaStore.applyFetched("thread-a", 1, 0, 900)

        const olderStart = 1_000 // request A goes out
        vi.setSystemTime(2_000)
        threadMetaStore.patch("thread-a", 2) // a live reply lands

        threadMetaStore.applyFetched("thread-a", 2, 0, 3_000) // request B, sent after the reply, lands
        threadMetaStore.applyFetched("thread-a", 1, 0, olderStart) // request A lands last

        expect(threadMetaStore.getCount("thread-a")).toBe(2)
    })

    it("accepts a fetch that went out after the last live reply", () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000)
        threadMetaStore.applyFetched("thread-b", 1, 0, 900)
        vi.setSystemTime(2_000)
        threadMetaStore.patch("thread-b", 2)

        threadMetaStore.applyFetched("thread-b", 3, 0, 2_500)
        expect(threadMetaStore.getCount("thread-b")).toBe(3)
    })
})
