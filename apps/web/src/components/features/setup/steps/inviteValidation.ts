import type { Invitee } from "../types"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** What's wrong with a row; InviteTable turns it into translated text. */
export type InviteError = "email_required" | "email_invalid" | "self" | "duplicate" | "first_name_required"

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** Empty rows are skipped; anything typed must be a new, valid address that isn't the admin's own. */
export const validateInviteEmail = (
    row: Invitee,
    { rows, invited, currentUser }: { rows: Invitee[]; invited: Invitee[]; currentUser: string },
): InviteError | null => {
    const email = normalizeEmail(row.email)
    if (!email) return row.first_name.trim() ? "email_required" : null
    if (!EMAIL_PATTERN.test(email)) return "email_invalid"
    if (email === normalizeEmail(currentUser)) return "self"
    const listed = rows.filter((other) => normalizeEmail(other.email) === email).length
    if (listed > 1 || invited.some((person) => normalizeEmail(person.email) === email)) return "duplicate"
    return null
}

export const validateInviteFirstName = (row: Invitee): InviteError | null =>
    row.email.trim() && !row.first_name.trim() ? "first_name_required" : null
