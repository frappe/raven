import { DEFAULT_SITE_KEY } from "@raven/lib/utils/nativeKeys"
import { nativePlatform, shellOrigin } from "./platform"

// Android hardware-back: go one step back in history, else leave to the shell.
export const registerAndroidBack = (): (() => void) => {
    if (nativePlatform() !== "android") return () => { }
    let disposed = false
    let handle: { remove: () => Promise<void> } | undefined
    import("@capacitor/app").then(async ({ App }) => {
        if (disposed) return
        const h = await App.addListener("backButton", ({ canGoBack }) => {
            if (canGoBack) window.history.back()
            else window.location.href = shellOrigin()
        })
        if (disposed) { h.remove().catch(() => { }); return }
        handle = h
    }).catch(() => { })
    return () => { disposed = true; handle?.remove().catch(() => { }) }
}

// Back to the picker. Session, tokens and push stay: switching is not signing out,
// so the next open of this site is silent (refresh token → login_with_token).
export const switchSite = async () => {
    const { Preferences } = await import("@capacitor/preferences")
    // Without a default site the shell shows the picker.
    await Preferences.remove({ key: DEFAULT_SITE_KEY })
    window.location.href = `${shellOrigin()}/`
}
