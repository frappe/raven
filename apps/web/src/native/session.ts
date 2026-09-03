import { isNative, shellOrigin } from "./platform"

export const loginRedirectUrl = (path: string, native: boolean, origin: string, shell: string) =>
    native
        ? `${shell}/?relogin=${encodeURIComponent(origin)}&to=${encodeURIComponent(path)}`
        : `/login?redirect-to=${encodeURIComponent(path)}`

export const logoutRedirectUrl = (native: boolean, origin: string, shell: string, appPath: string) =>
    native ? `${shell}/?signout=${encodeURIComponent(origin)}` : `/login?redirect-to=${encodeURIComponent(appPath)}`

// Dead session: the shell can re-mint one from its refresh token; browsers go to Frappe's login.
export const redirectToLogin = (path = window.location.pathname) => {
    window.location.href = loginRedirectUrl(path, isNative(), window.location.origin, shellOrigin())
}
