import { siteKey } from "@lib/site"

/** Set when the admin finishes or skips setup, so a failed save can't bring the flow back. Per site in the app. */
export const setupDoneStorageKey = () => siteKey("raven_setup_completed")

/** The Framework's setup wizard is done. Desk's boot has it at the top level too; the app's slim boot only here. */
export const isFrappeSetupComplete = (): boolean =>
    !!(window.frappe?.boot?.sysdefaults?.setup_complete ?? window.frappe?.boot?.setup_complete)

/** Boot flags it only for admins on a site that isn't set up. */
export const isSetupPending = (): boolean => {
    if (!window.frappe?.boot?.raven_setup_pending) return false
    try {
        return localStorage.getItem(setupDoneStorageKey()) !== "1"
    } catch {
        return true
    }
}

export const markSetupDoneLocally = () => {
    try {
        localStorage.setItem(setupDoneStorageKey(), "1")
    } catch {
        // Storage blocked: the server flag alone ends the flow on the next load.
    }
}

/** The installed app's offline launch reads boot from this cache; keep its onboarded flag in step with the save. */
export const markOnboardedInBootCache = () => {
    try {
        // The app stores the cache per site, under the same scoped key.
        const key = siteKey("raven-boot-cache")
        const cached = localStorage.getItem(key)
        if (!cached) return
        localStorage.setItem(key, JSON.stringify({ ...JSON.parse(cached), raven_onboarded: 1 }))
    } catch {
        // Corrupt or blocked storage: the next online launch caches a fresh boot.
    }
}
