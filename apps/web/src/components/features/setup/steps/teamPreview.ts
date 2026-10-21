import type { PreviewPerson } from "../preview/model"
import type { Invitee, SiteUser } from "../types"

/** The team step's DM list: everyone on the site, then sent invites, then invite rows (blank ones too). */
export const teamPreviewPeople = (rows: Invitee[], invited: Invitee[], siteUsers: SiteUser[]): PreviewPerson[] => [
    ...siteUsers.map((user) => ({ id: `user-${user.user}`, name: user.full_name, image: user.user_image })),
    ...invited.map((invitee) => ({ id: `invite-${invitee.email}`, name: invitee.first_name || invitee.email })),
    // Keyed by position, so typing into a row keeps it mounted.
    ...rows.map((row, index) => ({ id: `row-${index}`, name: row.first_name.trim() || row.email.trim() })),
]
