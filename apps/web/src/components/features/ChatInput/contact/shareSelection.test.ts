import { describe, expect, it } from "vitest"
import type { PickedContact } from "../../../../native/contacts"
import { canSendContact, contactTicks, selectedContacts } from "./shareSelection"

const contacts: PickedContact[] = [
    {
        name: "Priya",
        phones: [{ value: "+91 1", label: "Mobile" }, { value: "+91 2" }],
        emails: [{ value: "a@b.co" }],
        photo: "cGhvdG8=",
    },
    {
        name: "Sam",
        phones: [{ value: "+1 555" }],
        emails: [],
    },
]

const untickAllOf = (ticked: Set<string>, contactIndex: number) => {
    for (const key of [...ticked]) {
        if (key.startsWith(`${contactIndex}:`)) ticked.delete(key)
    }
}

describe("contact selection", () => {
    it("keys every field by its contact and kind", () => {
        expect([...contactTicks(contacts)]).toEqual([
            "0:phone:0",
            "0:phone:1",
            "0:email:0",
            "1:phone:0",
        ])
    })

    it("keeps the payloads unchanged when everything is ticked", () => {
        expect(selectedContacts(contacts, contactTicks(contacts))).toEqual(contacts)
    })

    it("drops an unticked phone", () => {
        const ticked = contactTicks(contacts)
        ticked.delete("0:phone:0")
        expect(selectedContacts(contacts, ticked)[0].phones).toEqual([{ value: "+91 2" }])
    })

    it("drops a contact with nothing ticked and keeps the rest", () => {
        const ticked = contactTicks(contacts)
        untickAllOf(ticked, 1)
        expect(selectedContacts(contacts, ticked)).toEqual([contacts[0]])
    })

    it("keeps the photo on a selected contact", () => {
        expect(selectedContacts(contacts, contactTicks(contacts))[0].photo).toBe("cGhvdG8=")
    })

    it("cannot send once nothing but names are left", () => {
        expect(canSendContact(new Set())).toBe(false)
    })

    it("can send with one email ticked", () => {
        expect(canSendContact(new Set(["0:email:0"]))).toBe(true)
    })
})
