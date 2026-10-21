import { describe, expect, it } from "vitest"
import { validateInviteEmail, validateInviteFirstName } from "./inviteValidation"

const row = (email: string, first_name = "Ravi") => ({ email, first_name })
const context = (rows: { email: string; first_name: string }[], invited: { email: string; first_name: string }[] = []) => ({
    rows,
    invited,
    currentUser: "admin@acme.com",
})

describe("validateInviteEmail", () => {
    it("lets an empty row through", () => {
        const empty = row("", "")
        expect(validateInviteEmail(empty, context([empty]))).toBeNull()
    })
    it("wants an email once a first name is typed", () => {
        const named = row("")
        expect(validateInviteEmail(named, context([named]))).toBe("email_required")
    })
    it("rejects a malformed address", () => {
        const bad = row("ravi@")
        expect(validateInviteEmail(bad, context([bad]))).toBe("email_invalid")
    })
    it("rejects the admin's own address, ignoring case and spaces", () => {
        const self = row(" Admin@Acme.com ")
        expect(validateInviteEmail(self, context([self]))).toBe("self")
    })
    it("rejects a second row with the same address", () => {
        const first = row("ravi@acme.com")
        const second = row("RAVI@acme.com")
        expect(validateInviteEmail(first, context([first, second]))).toBe("duplicate")
    })
    it("rejects someone invited earlier in setup", () => {
        const again = row("ravi@acme.com")
        expect(validateInviteEmail(again, context([again], [row("ravi@acme.com")]))).toBe("duplicate")
    })
    it("accepts a new, valid address", () => {
        const fresh = row("ravi@acme.com")
        expect(validateInviteEmail(fresh, context([fresh]))).toBeNull()
    })
})

describe("validateInviteFirstName", () => {
    it("wants a first name once an email is typed", () => {
        expect(validateInviteFirstName(row("ravi@acme.com", " "))).toBe("first_name_required")
    })
    it("lets an empty row through", () => {
        expect(validateInviteFirstName(row("", ""))).toBeNull()
    })
})
