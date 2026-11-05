import { describe, expect, it } from "vitest"
import type { KlipyGif } from "@lib/klipy"
import { gifSearchReducer, initialGifSearchState, openGifSearch } from "./gifSearchReducer"

const gif = (id: number): KlipyGif => ({ id, slug: `g${id}`, type: "gif", file: {} })
const [gifA, gifB, gifC] = [gif(1), gif(2), gif(3)]

describe("gifSearchReducer", () => {
    it("resets the list for a new query", () => {
        let s = gifSearchReducer(initialGifSearchState, { type: "loaded", page: { items: [gifA], hasNext: false } })
        s = gifSearchReducer(s, { type: "query", query: "cat" })
        expect(s).toMatchObject({ query: "cat", items: [], hasNext: true, status: "loading", rateLimited: false })
    })

    // Reopening the picker within minutes shows trending at once, without a request.
    it("opens on a remembered trending page", () => {
        expect(openGifSearch({ items: [gifA], hasNext: true })).toMatchObject({ query: "", items: [gifA], page: 1, hasNext: true, status: "idle" })
        expect(openGifSearch(undefined)).toBe(initialGifSearchState)
    })

    // A trailing space, or typing back to the same text, re-sends the query; a reset would refetch it.
    it("keeps the list when the query is unchanged", () => {
        expect(gifSearchReducer(initialGifSearchState, { type: "query", query: "" })).toBe(initialGifSearchState)
    })

    it("retries the failed page, keeping the pages already loaded", () => {
        const failed = { ...initialGifSearchState, items: [gifA], page: 1, status: "error" as const }
        expect(gifSearchReducer(failed, { type: "retry" })).toMatchObject({ items: [gifA], page: 1, status: "loading" })
    })

    it("retries only after an error", () => {
        const idle = { ...initialGifSearchState, status: "idle" as const }
        expect(gifSearchReducer(idle, { type: "retry" })).toBe(idle)
    })

    it("appends pages in KLIPY's order", () => {
        let s = gifSearchReducer(initialGifSearchState, { type: "query", query: "cat" })
        s = gifSearchReducer(s, { type: "loaded", page: { items: [gifA, gifB], hasNext: true } })
        s = gifSearchReducer(s, { type: "loaded", page: { items: [gifC], hasNext: false } })
        expect(s.items).toEqual([gifA, gifB, gifC])
        expect(s.page).toBe(2)
        expect(s.hasNext).toBe(false)
        expect(s.status).toBe("idle")
    })

    it("ends the list on an empty page, even if KLIPY says there is more", () => {
        const s = gifSearchReducer(initialGifSearchState, { type: "loaded", page: { items: [], hasNext: true } })
        expect(s.hasNext).toBe(false)
    })

    it("loads more only when there is a next page and nothing is loading", () => {
        const done = { ...initialGifSearchState, status: "idle" as const, hasNext: false }
        expect(gifSearchReducer(done, { type: "loadMore" })).toBe(done)
        expect(gifSearchReducer(initialGifSearchState, { type: "loadMore" })).toBe(initialGifSearchState)
        const more = { ...initialGifSearchState, status: "idle" as const }
        expect(gifSearchReducer(more, { type: "loadMore" }).status).toBe("loading")
    })

    it("doesn't retry a failed page by scrolling", () => {
        const failed = { ...initialGifSearchState, status: "error" as const }
        expect(gifSearchReducer(failed, { type: "loadMore" })).toBe(failed)
    })

    it("records a rate limit", () => {
        const s = gifSearchReducer(initialGifSearchState, { type: "query", query: "" })
        expect(gifSearchReducer(s, { type: "failed", rateLimited: true })).toMatchObject({ status: "error", rateLimited: true })
    })
})
