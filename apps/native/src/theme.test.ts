import { describe, expect, it } from "vitest"
import { themeClass } from "./theme"

describe("themeClass", () => {
    it("passes explicit choices through", () => {
        expect(themeClass("dark")).toBe("dark")
        expect(themeClass("light")).toBe("light")
    })
    it("treats system and junk as no override", () => {
        expect(themeClass("system")).toBeNull()
        expect(themeClass(null)).toBeNull()
        expect(themeClass(undefined)).toBeNull()
    })
})
