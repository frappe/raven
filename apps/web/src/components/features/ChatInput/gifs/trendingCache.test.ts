import { afterEach, describe, expect, it, vi } from "vitest"
import { recentTrending, rememberTrending } from "./trendingCache"

const page = { items: [{ id: 1, slug: "g1", type: "gif", file: {} }], hasNext: true }

describe("trendingCache", () => {
    afterEach(() => vi.useRealTimers())

    it("returns the remembered first page for five minutes", () => {
        vi.useFakeTimers()
        rememberTrending(page)
        vi.advanceTimersByTime(5 * 60_000 - 1)
        expect(recentTrending()).toBe(page)
        vi.advanceTimersByTime(1)
        expect(recentTrending()).toBeUndefined()
    })

    it("doesn't remember an empty page", () => {
        rememberTrending(page)
        rememberTrending({ items: [], hasNext: false })
        expect(recentTrending()).toBe(page)
    })
})
