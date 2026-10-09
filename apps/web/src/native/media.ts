import { siteOrigin } from "@lib/site"
import { nativePlugin } from "./platform"

// Contract of the RavenMedia plugin (apps/native/{android,ios}); the URL shape lives in mediaUrl.ts.
type RavenMediaPlugin = {
    setSession(options: { origin: string; token: string }): Promise<void>
    trim(options: { budgetBytes: number }): Promise<void>
}
const media = nativePlugin<RavenMediaPlugin>("RavenMedia")

/** The handler only ever attaches the bearer to this origin. Called at boot and after every refresh. */
export const setMediaSession = async (token: string) => {
    const { plugin } = await media()
    await plugin.setSession({ origin: siteOrigin(), token }).catch(() => { })
}

const BUDGET_BYTES = 200 * 1024 * 1024
const TRIM_EVERY_MS = 60 * 60 * 1000

let lastTrim = 0
/** Keeps the on-disk cache under budget, oldest files first. At most once an hour. */
const trimMediaCache = async () => {
    if (Date.now() - lastTrim < TRIM_EVERY_MS) return
    lastTrim = Date.now()
    const { plugin } = await media()
    await plugin.trim({ budgetBytes: BUDGET_BYTES }).catch(() => { })
}

/** Trims now and on every return to the foreground: the app can resume for days without a cold start. */
export const watchMediaCache = async () => {
    void trimMediaCache()
    const { App } = await import("@capacitor/app")
    await App.addListener("appStateChange", ({ isActive }) => { if (isActive) void trimMediaCache() })
}
