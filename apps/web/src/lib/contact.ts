/** One shared phone number or email address, with an optional label. */
export type ContactField = { value: string; label?: string }

/** A shared contact's payload, stored in the message's `json`. */
export type ContactPayload = { name: string; phones: ContactField[]; emails: ContactField[] }

const isField = (item: unknown): item is ContactField =>
    !!item && typeof (item as ContactField).value === "string"

const fields = (value: unknown): ContactField[] => (Array.isArray(value) ? value.filter(isField) : [])

/** A contact's `json` (object, or string from a fetch); null unless it has a name and a phone or email. */
// The server sanitises the payload on insert; this only guards the shape.
export const parseContactJson = (json: unknown): ContactPayload | null => {
    let value = json
    if (typeof value === "string") {
        try {
            value = JSON.parse(value)
        } catch {
            return null
        }
    }
    const { name, phones, emails } = (value ?? {}) as Record<string, unknown>
    if (typeof name !== "string" || !name) return null
    const contact = { name, phones: fields(phones), emails: fields(emails) }
    return contact.phones.length || contact.emails.length ? contact : null
}

/** First letters of the first and last word, uppercased. */
export const contactInitials = (name: string): string => {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (!words.length) return ""
    const chosen = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]]
    return chosen.map((word) => String.fromCodePoint(word.codePointAt(0)!)).join("").toUpperCase()
}

/** The first phone, else the first email (counts live only in the details sheet). */
export const contactDetailLine = (contact: ContactPayload): string =>
    contact.phones[0]?.value ?? contact.emails[0]?.value ?? ""
