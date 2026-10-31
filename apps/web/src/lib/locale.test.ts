import { describe, expect, it } from "vitest"
import { textDirection } from "./locale"

describe("textDirection", () => {
    it("follows the first letter, past any numbers, emoji or punctuation before it", () => {
        expect(textDirection("مرحبا Hello")).toBe("rtl")
        expect(textDirection("Hello مرحبا")).toBe("ltr")
        expect(textDirection("123 👍 مرحبا")).toBe("rtl")
        expect(textDirection("שלום")).toBe("rtl")
    })

    it("gives nothing for text with no letters, so it keeps the interface direction", () => {
        expect(textDirection("")).toBeUndefined()
        expect(textDirection("👍 123")).toBeUndefined()
    })
})
