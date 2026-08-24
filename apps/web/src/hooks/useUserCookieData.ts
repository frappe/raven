import Cookies from 'js-cookie'

/**
 * Simple hook to fetch user data from cookies
 * @returns name, full_name, user_image - all strings
 */
export const useUserCookieData = () => {
    const name = Cookies.get('user_id') ?? ''
    const full_name = Cookies.get('full_name') ?? ''
    const user_image = Cookies.get('user_image') ?? ''

    return {
        name,
        full_name,
        user_image,
    }
}