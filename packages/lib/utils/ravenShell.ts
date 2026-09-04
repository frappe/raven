import type { ShareIntent } from "./shareIntent"

// Contract of the shell's own Capacitor plugin (apps/native/{android,ios}). Types only:
// the shell registers it through @capacitor/core, the web app through a dynamic import.
export type RavenShellPlugin = {
    /** Android: the SEND intent MainActivity holds; `{}` when none. iOS shares go through send-intent. */
    getShareIntent(): Promise<{ intent?: ShareIntent }>
    /** Android: forget the held intent so a later read does not replay it. No-op on iOS. */
    clearShareIntent(): Promise<void>
    /** Expire the WebView's cookies for one site (a live sid would fail Frappe's CSRF check on login_with_token). */
    clearSiteCookies(options: { url: string }): Promise<void>
    /** Android: re-register the bridge script for the saved sites after the list changed. No-op on iOS. */
    syncAllowedOrigins(): Promise<void>
    /** Android: a warm share arrived (onNewIntent). iOS dispatches the `sendIntentReceived` DOM event instead. */
    addListener(event: "shareReceived", listener: () => void): Promise<{ remove(): Promise<void> }>
}
