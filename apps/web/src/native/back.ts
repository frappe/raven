import { hasOpenOverlay } from "@hooks/useHistoryBackClose"
import { listenNative, nativePlatform } from "./platform"

// Single-segment pages that are not footer roots (App.tsx routes).
const SUBPAGES = new Set(["search", "saved-messages", "share-target"])

// Root pages of the mobile app: the footer tabs and a workspace home, all one segment.
export const isRootPath = (pathname: string) => {
    const segments = pathname.split("/").filter(Boolean)
    return segments.length <= 1 && !SUBPAGES.has(segments[0] ?? "")
}

// Android hardware back: from a root page the app goes to the background, as Android apps do;
// else one step back. Decided by route: the WebView's canGoBack flag misses the router's pushState entries.
export const registerAndroidBack = (isRoot: () => boolean, goRoot: () => void): (() => void) => {
    if (nativePlatform() !== "android") return () => { }
    return listenNative(async () => {
        const { App } = await import("@capacitor/app")
        return App.addListener("backButton", () => {
            // An open sheet or viewer has a history entry of its own: back closes it first.
            if (hasOpenOverlay()) window.history.back()
            else if (isRoot()) void App.minimizeApp()
            // No history on a cold-start deep link (tap, share): go to the workspace home.
            else if (window.history.length > 1) window.history.back()
            else goRoot()
        })
    })
}
