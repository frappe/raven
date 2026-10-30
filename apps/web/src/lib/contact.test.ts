import { describe, expect, it } from "vitest"
import { contactDetailLine, contactInitials, parseContactJson } from "./contact"

const payload = {
    name: "Priya Sharma",
    phones: [{ value: "+91 98200 41234", label: "Mobile" }],
    emails: [{ value: "priya@northwind.co", label: "Work" }],
}

describe("parseContactJson", () => {
    it("reads objects and JSON strings", () => {
        expect(parseContactJson(payload)).toEqual(payload)
        expect(parseContactJson(JSON.stringify(payload))).toEqual(payload)
    })

    it("rejects junk and a payload without a phone or email", () => {
        for (const junk of [null, "x", "{", [], {}, { name: "Priya" }, { name: "Priya", phones: [] }, { name: 5, phones: [{ value: "1" }] }])
            expect(parseContactJson(junk)).toBeNull()
    })

    it("drops entries without a string value", () => {
        expect(
            parseContactJson({ name: "Priya", phones: [{ value: 7 }, { value: "1" }, null], emails: ["x", { value: "a@b.co" }] })
        ).toEqual({ name: "Priya", phones: [{ value: "1" }], emails: [{ value: "a@b.co" }] })
    })

    it("reads a payload missing one list", () => {
        expect(parseContactJson({ name: "Priya", phones: [{ value: "1" }] })).toEqual({
            name: "Priya",
            phones: [{ value: "1" }],
            emails: [],
        })
    })
})

describe("contactInitials", () => {
    it("uses the first and last word", () => {
        expect(contactInitials("Priya Sharma")).toBe("PS")
        expect(contactInitials("priya")).toBe("P")
    })

    it("returns nothing for a blank name", () => {
        expect(contactInitials("  ")).toBe("")
    })

    it("handles non-Latin names", () => {
        expect(contactInitials("Ελένη Παπαδοπούλου")).toBe("ΕΠ")
    })
})

describe("contactDetailLine", () => {
    const contact = (phones: { value: string }[], emails: { value: string }[]) => ({
        name: "Priya",
        phones,
        emails,
    })

    it("prefers the first phone", () => {
        expect(contactDetailLine(contact([{ value: "+91 98200 41234" }], []))).toBe("+91 98200 41234")
        expect(
            contactDetailLine(contact([{ value: "+91 1" }, { value: "+91 2" }], [{ value: "a@b.co" }]))
        ).toBe("+91 1")
    })

    it("falls back to the first email", () => {
        expect(contactDetailLine(contact([], [{ value: "a@b.co" }]))).toBe("a@b.co")
    })
})
