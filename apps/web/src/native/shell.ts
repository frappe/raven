import { nativePlugin } from "./platform"
import type { ShareIntent } from "./shareIntent"

// Contract of the app's own RavenShell plugin (apps/native/{android,ios}). Types only.
export type RavenShellPlugin = {
    /** Android: the SEND intent MainActivity holds; `{}` when none. iOS shares come through send-intent. */
    getShareIntent(): Promise<{ intent?: ShareIntent }>
    /** Android: forget the held intent so a later read does not replay it. No-op on iOS. */
    clearShareIntent(): Promise<void>
    /** Android: share a cached file through a chooser with no result tracking. iOS uses @capacitor/share. */
    share(options: { uri: string; title?: string; type?: string }): Promise<void>
    /** Re-read the mirrored app theme (native/theme.ts) and theme the canvas behind the page with it. */
    applyTheme(): Promise<void>
    /** The site's sign-in page in a session of its own: no cookies from an earlier account, none kept after. */
    authorize(options: { url: string; scheme: string; redirect: string }): Promise<{ url?: string; cancelled?: boolean }>
    /** Android: the page is listening for pushes, so the app's own service leaves them to it. */
    watchNotifications(options: { watching: boolean }): Promise<void>
    /** iOS: how many sites are signed in, which decides whether a notification names the site. */
    setSiteCount(options: { count: number }): Promise<void>
    /** Post a notification for another site; its tap reports through FirebaseMessaging like a push. */
    showNotification(options: { title?: string; body?: string; site?: string; image?: string; tag?: string; data: Record<string, string> }): Promise<void>
    /** Android: a warm share arrived. iOS dispatches the `sendIntentReceived` DOM event instead. */
    addListener(event: "shareReceived", listener: () => void): Promise<{ remove(): Promise<void> }>
}

export const ravenShell = nativePlugin<RavenShellPlugin>("RavenShell")
