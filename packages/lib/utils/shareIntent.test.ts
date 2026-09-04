import { describe, expect, it } from "vitest"
import { intentToPendingShare } from "./shareIntent"

describe("intentToPendingShare", () => {
    it("maps a text share to text + http(s) url", () => {
        const share = intentToPendingShare({ title: "T", description: "hello", type: "text/plain", url: "https://x.y" })
        expect(share).toEqual({ title: "T", text: "hello", url: "https://x.y" })
    })
    it("maps an image share to a files entry", () => {
        const share = intentToPendingShare({ title: "img", type: "image/png", url: "file:///a.png" })
        expect(share).toEqual({ title: "img", files: [{ uri: "file:///a.png", type: "image/png", name: "img" }] })
    })
    it("keeps every item of a multi-file share", () => {
        const share = intentToPendingShare({
            title: "a.png", type: "image/*", url: "file:///a.png",
            additionalItems: [
                { title: "b.png", type: "image/*", url: "file:///b.png" },
                { title: "c.png", type: "image/*", url: "file:///c.png" },
            ],
        })
        expect(share?.files?.map((f) => f.uri)).toEqual(["file:///a.png", "file:///b.png", "file:///c.png"])
        expect(share?.files?.map((f) => f.name)).toEqual(["a.png", "b.png", "c.png"])
    })
    it("skips additional items without a uri", () => {
        const share = intentToPendingShare({
            title: "a.png", type: "image/*", url: "file:///a.png",
            additionalItems: [{ title: "broken", type: "image/*" }],
        })
        expect(share?.files).toHaveLength(1)
    })
    it("treats a missing type as a text share", () => {
        expect(intentToPendingShare({ description: "hello" })).toEqual({ text: "hello" })
    })
    it("returns null when nothing usable (no text and no url)", () => {
        expect(intentToPendingShare({ title: "only a title" })).toBeNull()
        expect(intentToPendingShare({ type: "image/png", title: "img" })).toBeNull()
    })
    it("drops non-http(s) urls from text shares", () => {
        expect(intentToPendingShare({ description: "hello", url: "file:///a.txt" })).toEqual({ text: "hello" })
    })
})
