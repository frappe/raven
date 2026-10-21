import { describe, expect, it } from "vitest"
import { consumeSharedFiles, stashSharedFiles } from "./sharedFiles"

const file = new File(["x"], "a.png", { type: "image/png" })

describe("shared files stash", () => {
    it("hands the files to the picked channel only, once", () => {
        stashSharedFiles("picked", [file])
        expect(consumeSharedFiles("other")).toEqual([])
        expect(consumeSharedFiles("picked")).toEqual([file])
        expect(consumeSharedFiles("picked")).toEqual([])
    })

    it("holds nothing for an empty share", () => {
        stashSharedFiles("picked", [])
        expect(consumeSharedFiles("picked")).toEqual([])
    })
})
