import { describe, expect, it } from "vitest"
import { scoreFilterRow } from "./filterScore"

/** The shape the filters use: identity is the doc name, the readable label is a keyword. */
const score = (search: string, label: string, id = "doc-id") => scoreFilterRow(id, search, [label])

describe("scoreFilterRow", () => {
    it("keeps every row when there is no search", () => {
        expect(score("", "anything")).toBe(1)
        expect(score("   ", "anything")).toBe(1)
    })

    it("drops rows the search cannot reach", () => {
        expect(score("zzzz", "general")).toBe(0)
    })

    it("ranks an exact name above every weaker kind of match", () => {
        const exact = score("general", "general")
        const prefix = score("general", "general-chat")
        const wordStart = score("general", "europe-general")
        const substring = score("general", "thegeneralthing")
        const subsequence = score("gnrl", "general")

        expect(exact).toBeGreaterThan(prefix)
        expect(prefix).toBeGreaterThan(wordStart)
        expect(wordStart).toBeGreaterThan(substring)
        expect(substring).toBeGreaterThan(subsequence)
        expect(subsequence).toBeGreaterThan(0)
    })

    it("no longer surfaces the long name that used to outrank an exact match", () => {
        // cmdk's default put this above the channel actually called "general"
        expect(score("general", "long-ahh-channel-name-lol-edited-loooool")).toBe(0)
        expect(score("general", "general")).toBe(1)
    })

    it("finds a row by its id, but ranks it below any name match", () => {
        const byId = scoreFilterRow("patiladitya781@gmail.com", "patiladitya781", ["Aditya Patil"])
        const byName = score("aditya", "Aditya Patil")

        expect(byId).toBeGreaterThan(0)
        expect(byName).toBeGreaterThan(byId)
    })

    it("is case-insensitive", () => {
        expect(score("YODA", "Yoda")).toBe(score("yoda", "yoda"))
    })

    it("still matches a typo, at the lowest tier", () => {
        const typo = score("adtya", "Aditya Patil")
        expect(typo).toBeGreaterThan(0)
        expect(typo).toBeLessThan(score("aditya", "Aditya Patil"))
    })

    it("treats a hyphen in the search as text, not a pattern", () => {
        // escaping matters: "new-channel" reaching the word-start regex unescaped would throw
        // or match the wrong thing
        expect(() => score("new-channel", "new-channel")).not.toThrow()
        expect(score("new-channel", "new-channel")).toBe(1)
    })

    it("scores by the best keyword when a row has several", () => {
        expect(scoreFilterRow("id", "smital", ["Some Channel", "Smital"])).toBe(1)
    })
})
