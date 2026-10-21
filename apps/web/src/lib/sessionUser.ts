import Cookies from "js-cookie"

export type SessionUser = { name: string; fullName: string; image: string }

// Native fills this from boot; the browser reads Frappe's cookies.
let fromBoot: SessionUser | null = null

export const setSessionUser = (user: SessionUser) => { fromBoot = user }
/** Native logout: back to the cookie view, which has no user, so isLoggedIn() turns false. */
export const clearSessionUser = () => { fromBoot = null }

export const sessionUser = (): SessionUser =>
    fromBoot ?? { name: Cookies.get("user_id") ?? "", fullName: Cookies.get("full_name") ?? "", image: Cookies.get("user_image") ?? "" }

export const isLoggedIn = (): boolean => {
    const { name } = sessionUser()
    return !!name && name !== "Guest"
}
