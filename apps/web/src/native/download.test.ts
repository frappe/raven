import { describe, expect, it, vi } from "vitest"

vi.mock("@lib/site", () => ({ siteOrigin: () => "https://a.com", siteToken: () => "t", siteUrl: (p: string) => `https://a.com${p}` }))

import { downloadName } from "./download"

describe("downloadName", () => {
    it("is stable per path and safe on disk", () => {
        const name = downloadName("/private/files/a b.mp4?fid=1")
        expect(name).toBe(downloadName("/private/files/a b.mp4?fid=1"))
        expect(name).toMatch(/^media\/[0-9a-z]+\/a_b\.mp4$/)
        expect(downloadName("/private/files/other.mp4")).not.toBe(name)
        expect(downloadName("/files/..")).toMatch(/\/file$/)
        expect(downloadName("/files/.env")).toMatch(/\/env$/)
    })
    it("saves an API download under the name given, one folder per query", () => {
        const zip = (ids: string) => downloadName(`https://a.com/api/method/x.download?ids=${ids}`, "raven-files.zip")
        expect(zip("1")).toMatch(/^media\/[0-9a-z]+\/raven-files\.zip$/)
        expect(zip("1")).not.toBe(zip("2"))
        expect(downloadName("/files/a.png", "...")).toMatch(/\/a\.png$/)
    })
})
