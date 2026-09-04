import { describe, expect, it } from "vitest"
import { pendingShareToParams } from "./shareIn"

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
    it("lists every file name of a multi-file share", () => {
        const p = pendingShareToParams({ files: [{ uri: "file:///a.png", name: "a.png" }, { uri: "file:///b.png", name: "b.png" }] })
        expect(p.get("files")).toBe("2")
        expect(p.get("names")).toBe("a.png, b.png")
    })
})
