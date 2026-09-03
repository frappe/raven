import { describe, expect, it } from "vitest"
import { intentToPendingShare, pendingShareToParams, shareSignature } from "./shareIn"

describe("shareSignature", () => {
    it("is stable for equal intents", () => {
        const a = { title: "T", description: "hello", type: "text/plain", url: "https://x.y" }
        expect(shareSignature(a)).toBe(shareSignature({ ...a }))
    })
    it("differs when url differs", () => {
        const a = { title: "T", description: "hello", type: "text/plain", url: "https://x.y" }
        expect(shareSignature(a)).not.toBe(shareSignature({ ...a, url: "https://x.z" }))
    })
})

describe("pendingShareToParams", () => {
    it("maps text/url/title", () => {
        const p = pendingShareToParams({ title: "T", text: "hello", url: "https://x.y" })
        expect(p.get("title")).toBe("T")
        expect(p.get("text")).toBe("hello")
        expect(p.get("url")).toBe("https://x.y")
    })
    it("keeps text empty and reports the file count when only files are shared", () => {
        const p = pendingShareToParams({ files: [{ uri: "file:///a.png", name: "a.png" }] })
        expect(p.get("text")).toBe("")
        expect(p.get("files")).toBe("1")
        expect(p.get("names")).toBe("a.png")
    })
})

describe("intentToPendingShare", () => {
    it("maps a text share to text + http(s) url", () => {
        const share = intentToPendingShare({ title: "T", description: "hello", type: "text/plain", url: "https://x.y" })
        expect(share).toEqual({ title: "T", text: "hello", url: "https://x.y" })
    })
    it("maps an image share to a files entry", () => {
        const share = intentToPendingShare({ title: "img", type: "image/png", url: "file:///a.png" })
        expect(share).toEqual({ title: "img", files: [{ uri: "file:///a.png", type: "image/png", name: "img" }] })
    })
    it("treats a missing type as a text share", () => {
        const share = intentToPendingShare({ description: "hello" })
        expect(share).toEqual({ text: "hello" })
    })
    it("returns null when nothing usable (no text and no url)", () => {
        expect(intentToPendingShare({ title: "only a title" })).toBeNull()
        expect(intentToPendingShare({ type: "image/png", title: "img" })).toBeNull()
    })
    it("drops non-http(s) urls from text shares", () => {
        const share = intentToPendingShare({ description: "hello", url: "file:///a.txt" })
        expect(share).toEqual({ text: "hello" })
    })
})
