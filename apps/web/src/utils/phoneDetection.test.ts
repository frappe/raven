import { describe, expect, it } from "vitest"
import { MAYBE_PHONE_RE, phoneHref, splitPhoneRuns } from "./phoneDetection"

/** The hrefs detected in a text, in order — most assertions only care about these. */
const hrefsIn = (text: string): string[] =>
    (splitPhoneRuns(text) ?? []).filter((run) => run.href).map((run) => run.href!)

describe("splitPhoneRuns — accepts", () => {
    it("international numbers with +", () => {
        expect(hrefsIn("call +91 98765 43210 now")).toEqual(["tel:+919876543210"])
        expect(hrefsIn("+1 (555) 123-4567")).toEqual(["tel:+15551234567"])
        expect(hrefsIn("+442071234567")).toEqual(["tel:+442071234567"])
    })

    it("separated local formats", () => {
        expect(hrefsIn("98765 43210")).toEqual(["tel:9876543210"])
        expect(hrefsIn("(555) 123-4567")).toEqual(["tel:5551234567"])
        expect(hrefsIn("call 555-123-4567 today")).toEqual(["tel:5551234567"])
    })

    it("bare 10-digit runs (the classic mobile share)", () => {
        expect(hrefsIn("my number is 9876543210")).toEqual(["tel:9876543210"])
    })

    it("keeps the opening paren inside the linked text", () => {
        const runs = splitPhoneRuns("(555) 123-4567")!
        expect(runs[0]).toEqual({ text: "(555) 123-4567", href: "tel:5551234567" })
    })

    it("multiple numbers in one text, with surrounding prose preserved", () => {
        const runs = splitPhoneRuns("Call +91 98765 43210 or (555) 123-4567, thanks!")!
        expect(runs).toEqual([
            { text: "Call " },
            { text: "+91 98765 43210", href: "tel:+919876543210" },
            { text: " or " },
            { text: "(555) 123-4567", href: "tel:5551234567" },
            { text: ", thanks!" },
        ])
    })
})

describe("splitPhoneRuns — rejects", () => {
    const expectNoLink = (text: string) => expect(splitPhoneRuns(text)).toBeNull()

    it("dates", () => {
        expectNoLink("due 2026-09-08")
        expectNoLink("due 08-09-2026")
        expectNoLink("(2026-09-08)")
    })

    it("amounts and bare non-10-digit runs", () => {
        expectNoLink("total is 1000000")
        expectNoLink("order 1234567890123")
        expectNoLink("otp 12345678")
    })

    it("IPs, versions, dotted formats (dots are not separators)", () => {
        expectNoLink("host 192.168.11.12")
        expectNoLink("released v1.2.3")
        expectNoLink("call 555.123.4567")
    })

    it("digits glued to words, emails, ids", () => {
        expectNoLink("ticket abc12345678901")
        expectNoLink("mail me at a1234567890@x.com")
        expectNoLink("build-1234567890")
    })

    it("short runs, ranges, issue refs", () => {
        expectNoLink("meeting 10-20 people")
        expectNoLink("PR #2229")
        expectNoLink("+123456")
        expectNoLink("row 1234567")
    })

    it("plain prose returns null (caller keeps the original node)", () => {
        expectNoLink("no digits here at all")
    })
})

describe("phoneHref", () => {
    it("normalizes separators out and keeps the +", () => {
        expect(phoneHref("+91 98765 43210")).toBe("tel:+919876543210")
        expect(phoneHref("(555) 123-4567")).toBe("tel:5551234567")
    })

    it("bounds international digit counts to 7-15", () => {
        expect(phoneHref("+123456")).toBeNull()
        expect(phoneHref("+1234567")).toBe("tel:+1234567")
        expect(phoneHref("+123456789012345")).toBe("tel:+123456789012345")
        expect(phoneHref("+1234567890123456")).toBeNull()
    })

    it("bounds separated local forms to 8-12 digits", () => {
        expect(phoneHref("12 34 56")).toBeNull()
        expect(phoneHref("1234 5678")).toBe("tel:12345678")
        expect(phoneHref("12345 12345 123")).toBeNull()
    })
})

describe("MAYBE_PHONE_RE gate", () => {
    it("rejects digit-free and short-digit text (the hot path)", () => {
        expect(MAYBE_PHONE_RE.test("can you review the PR when you get a chance?")).toBe(false)
        expect(MAYBE_PHONE_RE.test("meet at 10")).toBe(false)
    })

    it("passes anything the scanner could match", () => {
        expect(MAYBE_PHONE_RE.test("+91 98765 43210")).toBe(true)
        expect(MAYBE_PHONE_RE.test("9876543210")).toBe(true)
    })
})

describe("pathological input", () => {
    it("handles a large digit-heavy text without qualifying garbage", () => {
        // 2KB of 20-digit runs: nothing should link (bare runs must be exactly 10
        // digits), and this must return fast (bounded repetition, no backtracking).
        const text = "12345678901234567890 ".repeat(100)
        expect(splitPhoneRuns(text)).toBeNull()
    })
})
