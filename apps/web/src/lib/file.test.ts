import { describe, expect, it } from "vitest"
import { getAbsoluteFileURL } from "./file"

const ORIGIN = "https://raven.test"

describe("getAbsoluteFileURL", () => {
    it("makes a relative path absolute", () => {
        expect(getAbsoluteFileURL("/files/report.pdf", ORIGIN)).toBe("https://raven.test/files/report.pdf")
    })

    it("strips the fid access token", () => {
        expect(getAbsoluteFileURL("/private/files/report.pdf?fid=abc123", ORIGIN)).toBe(
            "https://raven.test/private/files/report.pdf",
        )
    })

    it("leaves an already-absolute URL alone", () => {
        expect(getAbsoluteFileURL("https://cdn.example.com/a.pdf", ORIGIN)).toBe("https://cdn.example.com/a.pdf")
    })

    it("resolves a protocol-relative URL against the origin's protocol", () => {
        expect(getAbsoluteFileURL("//cdn.example.com/a.pdf", ORIGIN)).toBe("https://cdn.example.com/a.pdf")
    })

    it("encodes spaces in the filename", () => {
        expect(getAbsoluteFileURL("/files/my report.pdf", ORIGIN)).toBe("https://raven.test/files/my%20report.pdf")
    })
})
