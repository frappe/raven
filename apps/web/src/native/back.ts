import { listenNative, nativePlatform } from "./platform"
import { switchSite } from "./session"

// Single-segment pages that are not footer roots (App.tsx routes).
const SUBPAGES = new Set(["search", "saved-messages", "share-target"])

// Root pages of the mobile app: the footer tabs and a workspace home, all one segment.
export const isRootPath = (pathname: string) => {
    const segments = pathname.split("/").filter(Boolean)
    return segments.length <= 1 && !SUBPAGES.has(segments[0] ?? "")
}

// Android hardware back: to the picker from a root page, else one step back. Decided by route:
// the WebView's canGoBack flag misses the router's pushState entries.
export const registerAndroidBack = (isRoot: () => boolean, goRoot: () => void): (() => void) => {
    if (nativePlatform() !== "android") return () => { }
    return listenNative(async () => (await import("@capacitor/app")).App.addListener("backButton", () => {
        if (isRoot()) switchSite()
        // No history on a cold-start deep link (tap, share): go to the workspace home.
        else if (window.history.length > 1) window.history.back()
        else goRoot()
    }))
}
