import type { ContactPayload } from "@lib/contact"
import type { PickedContact } from "../../../../native/contacts"

/** Tick keys for every contact's phones and emails; every field starts selected. */
export const contactTicks = (contacts: ContactPayload[]): Set<string> =>
    new Set(
        contacts.flatMap((contact, contactIndex) => [
            ...contact.phones.map((_, index) => `${contactIndex}:phone:${index}`),
            ...contact.emails.map((_, index) => `${contactIndex}:email:${index}`),
        ]),
    )

/** The contacts with only their ticked fields; a contact left with nothing is dropped. */
export const selectedContacts = (contacts: PickedContact[], ticked: Set<string>): PickedContact[] =>
    contacts.flatMap((contact, contactIndex) => {
        const phones = contact.phones.filter((_, index) => ticked.has(`${contactIndex}:phone:${index}`))
        const emails = contact.emails.filter((_, index) => ticked.has(`${contactIndex}:email:${index}`))
        return phones.length || emails.length ? [{ ...contact, phones, emails }] : []
    })

/** A contact needs one phone or email; ticks only ever name a real field. */
export const canSendContact = (ticked: Set<string>): boolean => ticked.size > 0
