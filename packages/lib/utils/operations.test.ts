import { describe, expect, it } from "vitest"
import { getFileExtension, getFileName } from "./operations"

const DOWNLOAD_LINK = "/api/method/download_file?file_url=/private/files/HB7AW64I_54957.jpg&file_name=54957.jpg"

describe("getFileName", () => {
    it("takes the last part of a path", () => {
        expect(getFileName("/private/files/report.pdf?fid=abc123")).toBe("report.pdf")
    })

    it("takes the name a download link gives", () => {
        expect(getFileName(DOWNLOAD_LINK)).toBe("54957.jpg")
    })

    it("falls back to the file a download link points at", () => {
        expect(getFileName("/api/method/download_file?file_url=/private/files/a%20b.png")).toBe("a b.png")
    })
})

describe("getFileExtension", () => {
    it("reads the extension of a download link's file", () => {
        expect(getFileExtension(DOWNLOAD_LINK)).toBe("jpg")
    })

    it("is empty for a name without one", () => {
        expect(getFileExtension("/files/README")).toBe("")
    })
})
