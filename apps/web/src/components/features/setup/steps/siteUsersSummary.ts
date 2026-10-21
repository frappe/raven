import _ from "@lib/translate"
import type { SiteUser } from "../types"

const firstName = (user: SiteUser) => (user.full_name || user.user).trim().split(" ")[0]

/** "Alex and Sam", "Alex, Sam and Jordan", "Alex, Sam and 3 others" are already on this site. */
export const siteUsersSummary = (users: SiteUser[]): string => {
    const [first, second, third] = users.map(firstName)
    const others = users.length - 2
    if (others <= 0) return _("{0} and {1} are already on this site", [first, second])
    // Three people are all named: "1 other" would hide one person for no gain.
    if (others === 1) return _("{0}, {1} and {2} are already on this site", [first, second, third])
    return _("{0}, {1} and {2} others are already on this site", [first, second, String(others)])
}
