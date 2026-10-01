import { describe, expect, it } from "vitest"
import { intentToPendingShare } from "./shareIntent"

describe("intentToPendingShare", () => {
    it("maps a text share to text and url", () => {
        expect(intentToPendingShare({ type: "text/plain", description: "hi", url: "https://x.y" })).toEqual({ title: undefined, text: "hi", url: "https://x.y" })
    })
    it("collects files from the item and additionalItems", () => {
        const share = intentToPendingShare({ type: "image/png", title: "a.png", url: "file:///a", additionalItems: [{ type: "image/jpeg", title: "b.jpg", url: "file:///b" }] })
        expect(share?.files).toEqual([{ uri: "file:///a", type: "image/png", name: "a.png" }, { uri: "file:///b", type: "image/jpeg", name: "b.jpg" }])
    })
    it("returns null with nothing usable", () => {
        expect(intentToPendingShare({ type: "text/plain" })).toBeNull()
    })
    it("treats a text-typed item with a file uri as a file", () => {
        const share = intentToPendingShare({ type: "text/plain", title: "notes.txt", description: "", url: "file:///notes.txt" })
        expect(share?.files).toEqual([{ uri: "file:///notes.txt", type: "text/plain", name: "notes.txt" }])
        expect(share?.title).toBeUndefined()
    })
})
