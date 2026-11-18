import { describe, expect, it } from "vitest"
import { isMaskedPassword } from "./password"

describe("isMaskedPassword", () => {
    it("is true for a stored secret Frappe sends back as asterisks", () => {
        expect(isMaskedPassword("**********")).toBe(true)
    })

    it("is false for anything a person types, asterisks included", () => {
        expect(isMaskedPassword("abc*")).toBe(false)
        expect(isMaskedPassword("*a*")).toBe(false)
        expect(isMaskedPassword("")).toBe(false)
        expect(isMaskedPassword(undefined)).toBe(false)
    })
})
