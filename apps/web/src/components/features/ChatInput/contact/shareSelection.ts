import type { ContactPayload } from "@lib/contact"

/** Tick keys for a contact's phones and emails; every field starts selected. */
export const contactTicks = (contact: ContactPayload): Set<string> =>
    new Set([
        ...contact.phones.map((_, index) => `phone:${index}`),
        ...contact.emails.map((_, index) => `email:${index}`),
    ])

/** The contact with only the ticked phones and emails kept. */
export const selectedContact = (contact: ContactPayload, ticked: Set<string>): ContactPayload => ({
    name: contact.name,
    phones: contact.phones.filter((_, index) => ticked.has(`phone:${index}`)),
    emails: contact.emails.filter((_, index) => ticked.has(`email:${index}`)),
})

/** A contact needs one phone or email; ticks only ever name a real field. */
export const canSendContact = (ticked: Set<string>): boolean => ticked.size > 0
