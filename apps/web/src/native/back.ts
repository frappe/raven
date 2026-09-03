import { nativePlatform, shellOrigin } from "./platform"
import { disableNativePush } from "./push"

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

// Leaves this site: stop its pushes, then return to the picker.
export const switchSite = async () => {
    await disableNativePush().catch(() => { })
    const { Preferences } = await import("@capacitor/preferences")
    // Same key as apps/native/src/sites.ts DEFAULT_SITE_KEY.
    await Preferences.remove({ key: "defaultSite" })
    window.location.href = `${shellOrigin()}/?signout=${encodeURIComponent(window.location.origin)}`
}
