import type { UserData } from "@db"
import type { ContactPayload } from "@lib/contact"

export type ContactUser = { user: UserData; isSelf: boolean }

/** The Raven user behind a contact's first email that matches an enabled, non-bot user. */
export const matchContactUser = (
    contact: ContactPayload,
    users: Map<string, UserData>,
    self: string,
): ContactUser | null => {
    for (const email of contact.emails) {
        // Frappe stores user ids as lowercased emails.
        const user = users.get(email.value.trim().toLowerCase())
        if (!user || user.enabled === 0 || user.type === "Bot") continue
        return { user, isSelf: user.name === self }
    }
    return null
}
