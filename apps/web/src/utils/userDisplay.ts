import Cookies from "js-cookie"
import _ from "@lib/translate"

/**
 * The signed-in user's id, read from the session cookie once per session.
 *
 * Cached because the callers are list ROWS: every user/DM picker in the app asks "is this
 * me?" for each row it renders, on every keystroke. `useUserCookieData` re-parses
 * `document.cookie` on each call, which is the wrong shape for that. The id can't change
 * without a full page load, so one read is enough — unlike `user_image`, which that hook
 * deliberately keeps live.
 */
let currentUserID: string | undefined
const getCurrentUserID = (): string => {
    // Retries while empty rather than caching a miss: a cached "" would make every row
    // "not me" for the rest of the session if this ever ran before the cookie was readable.
    if (!currentUserID) currentUserID = Cookies.get("user_id") ?? ""
    return currentUserID
}

/** Whether this user id is the signed-in user. */
export const isCurrentUser = (userID?: string): boolean => !!userID && userID === getCurrentUserID()

/**
 * A person's name as it should read in a list you pick from, with "(You)" appended when
 * that person is you.
 *
 * Every surface where you can select a user or a DM shows this — the search filters, the
 * forward dialog, the command menu, the DM sidebar — so the suffix is defined once here
 * rather than re-spelled per list. A translated string assembled in five places drifts.
 *
 * Presentation only: pass the PLAIN name to cmdk's `keywords`, never this. The suffix
 * would otherwise make every self row match a search for "you".
 */
export const getUserDisplayName = (name: string, isSelf: boolean): string =>
    isSelf ? _("{0} (You)", [name]) : name
