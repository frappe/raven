import { afterEach, describe, expect, it, vi } from "vitest"
import { pendingShareToParams, readNativeFiles } from "./shareIn"

vi.mock("@capacitor/core", () => ({ Capacitor: { convertFileSrc: (uri: string) => uri } }))

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

describe("readNativeFiles", () => {
    afterEach(() => vi.unstubAllGlobals())
    const answer = (status: number) => ({ ok: status >= 200 && status < 300, status, blob: async () => new Blob(["bytes"]) })

    it("reads a file the route answers without an HTTP status (iOS video and audio)", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => answer(0)))
        const files = await readNativeFiles([{ uri: "file:///clip.mp4", name: "clip.mp4", type: "video/mp4" }])
        expect(files.map((f) => [f.name, f.type, f.size])).toEqual([["clip.mp4", "video/mp4", 5]])
    })
    it("keeps #, ? and % of a file name inside the path", async () => {
        const fetched = vi.fn(async (_uri: string) => answer(200))
        vi.stubGlobal("fetch", fetched)
        await readNativeFiles([{ uri: "file:///picked/Track%20%233%20100%25%3F.mp3" }])
        const url = new URL(fetched.mock.calls[0][0])
        expect([decodeURIComponent(url.pathname), url.hash, url.search]).toEqual(["/picked/Track #3 100%?.mp3", "", ""])
    })
    it("reads one file at a time, so several large picks are never in flight together", async () => {
        let inFlight = 0, most = 0
        vi.stubGlobal("fetch", vi.fn(async () => {
            most = Math.max(most, ++inFlight)
            await new Promise((resolve) => setTimeout(resolve, 5))
            inFlight--
            return answer(200)
        }))
        const files = await readNativeFiles([{ uri: "file:///a.mov", name: "a.mov" }, { uri: "file:///b.mov", name: "b.mov" }, { uri: "file:///c.mov", name: "c.mov" }])
        expect([most, files.map((f) => f.name)]).toEqual([1, ["a.mov", "b.mov", "c.mov"]])
    })
    it("drops a file the route refuses or cannot read, keeping the rest", async () => {
        vi.stubGlobal("fetch", vi.fn(async (uri: string) => {
            if (uri.includes("gone")) throw new TypeError("Load failed")
            return answer(uri.includes("denied") ? 404 : 200)
        }))
        const files = await readNativeFiles([{ uri: "file:///gone.mp4" }, { uri: "file:///denied.pdf" }, { uri: "file:///ok.pdf", name: "ok.pdf" }])
        expect(files.map((f) => f.name)).toEqual(["ok.pdf"])
    })
})
