import { describe, expect, it } from "vitest"
import type { ContactPayload } from "@lib/contact"
import { canSendContact, contactTicks, selectedContact } from "./shareSelection"

const contact: ContactPayload = {
    name: "Priya",
    phones: [{ value: "+91 1", label: "Mobile" }, { value: "+91 2" }],
    emails: [{ value: "a@b.co" }],
}

describe("contact selection", () => {
    it("keeps the payload unchanged when everything is ticked", () => {
        expect(selectedContact(contact, contactTicks(contact))).toEqual(contact)
    })

    it("drops an unticked phone", () => {
        const ticked = contactTicks(contact)
        ticked.delete("phone:0")
        expect(selectedContact(contact, ticked).phones).toEqual([{ value: "+91 2" }])
    })

    it("cannot send once nothing but the name is left", () => {
        expect(canSendContact(new Set())).toBe(false)
    })

    it("can send with one email ticked", () => {
        expect(canSendContact(new Set(["email:0"]))).toBe(true)
    })
})
