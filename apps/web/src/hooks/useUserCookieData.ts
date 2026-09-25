import { sessionUser } from "@lib/sessionUser"

/**
 * The current user's id, name, and image (from Frappe's cookies, or from boot in native).
 * @returns name, full_name, user_image - all strings
 */
export const useUserCookieData = () => {
    const { name, fullName: full_name, image: user_image } = sessionUser()
    return { name, full_name, user_image }
}
