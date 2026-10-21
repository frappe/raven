import { describe, expect, it } from "vitest"
import { mergeSuggestions, sameEmojiSet, toSuggestedSet, type ReactionUsageRow } from "./reactionUsage"
import type { QuickEmoji } from "./preferences"

const row = (reaction: string, uses: number, custom = false, name?: string): ReactionUsageRow => ({
    reaction,
    is_custom: custom ? 1 : 0,
    reaction_escaped: name,
    uses,
})

describe("toSuggestedSet", () => {
    it("maps native and custom rows, keeping server order", () => {
        const set = toSuggestedSet([row("👍", 5), row("/files/party.png", 3, true, "party-blob")], 2)
        expect(set).toEqual([
            { id: "👍", native: "👍" },
            { id: "party-blob", src: "/files/party.png" },
        ])
    })

    it("returns nothing unless a FULL set exists (applied as one unit)", () => {
        expect(toSuggestedSet([row("👍", 5)], 2)).toEqual([])
        expect(toSuggestedSet(undefined, 2)).toEqual([])
    })

    it("caps at n", () => {
        expect(toSuggestedSet([row("a", 3), row("b", 2), row("c", 1)], 2)).toHaveLength(2)
    })
})

describe("sameEmojiSet", () => {
    const set = (...ids: string[]): QuickEmoji[] => ids.map((id) => ({ id }))

    it("matches regardless of order", () => {
        expect(sameEmojiSet(set("a", "b"), set("b", "a"))).toBe(true)
    })

    it("matches a picker slug id against a char id via native", () => {
        expect(sameEmojiSet([{ id: "❤️", native: "❤️" }], [{ id: "heart", native: "❤️" }])).toBe(true)
    })

    it("differs on any member or length", () => {
        expect(sameEmojiSet(set("a", "b"), set("a", "c"))).toBe(false)
        expect(sameEmojiSet(set("a"), set("a", "b"))).toBe(false)
    })

    it("compares as a multiset — duplicates must match too", () => {
        expect(sameEmojiSet(set("a", "a", "b"), set("a", "b", "b"))).toBe(false)
        expect(sameEmojiSet(set("a", "a", "b"), set("b", "a", "a"))).toBe(true)
    })
})

describe("mergeSuggestions", () => {
    const set = (...ids: string[]): QuickEmoji[] => ids.map((id) => ({ id }))
    const ids = (emojis: QuickEmoji[]) => emojis.map((emoji) => emoji.id)

    it("replaces the first n slots and keeps the rest", () => {
        const next = mergeSuggestions(set("a", "b", "c", "d", "e", "f"), set("w", "x", "y", "z"), 4)
        expect(ids(next)).toEqual(["w", "x", "y", "z", "e", "f"])
    })

    it("replaces everything when n covers all slots", () => {
        const next = mergeSuggestions(set("a", "b", "c"), set("x", "y", "z"), 3)
        expect(ids(next)).toEqual(["x", "y", "z"])
    })

    it("refills a kept slot that would duplicate a suggestion", () => {
        // "e" is now suggested; its old slot 5 gets a replaced head emoji.
        const next = mergeSuggestions(set("a", "b", "c", "d", "e", "f"), set("e", "x", "y", "z"), 4)
        expect(ids(next)).toEqual(["e", "x", "y", "z", "a", "f"])
    })

    it("drops a duplicate kept slot when no refill is free", () => {
        // Every old head emoji is suggested, so nothing can refill slot 5.
        const next = mergeSuggestions(set("a", "b", "a", "x"), set("a", "b", "x"), 3)
        expect(ids(next)).toEqual(["a", "b", "x"])
    })
})
