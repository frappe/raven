import { describe, expect, it } from "vitest"
import { hasDirtyFields } from "./formState"

describe("hasDirtyFields", () => {
    it("is false for an empty map or one whose fields returned to default", () => {
        expect(hasDirtyFields({})).toBe(false)
        expect(hasDirtyFields({ items: [{ label: false }] })).toBe(false)
    })

    it("finds an edit at any depth", () => {
        expect(hasDirtyFields({ bot_name: true })).toBe(true)
        expect(hasDirtyFields({ items: [{ label: false }, { label: true }] })).toBe(true)
    })
})
