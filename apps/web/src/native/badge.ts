// Native icon-badge adapter. Dynamic import so browser bundles stay Capacitor-free.
// On iOS the plugin asks for notification permission before every write; the one prompt
// belongs to push (initNativePush), so the badge waits until notifications are allowed.
// Once granted, the system never returns to "not asked", so the check is not repeated.
let granted = false
// The count asked for last, applied once notifications are allowed (reapplyNativeBadge).
let wanted: number | undefined

export const setNativeBadge = (count: number): Promise<void> => {
    wanted = count
    return import("@capawesome/capacitor-badge")
        .then(async ({ Badge }) => {
            granted ||= (await Badge.checkPermissions()).display === "granted"
            if (!granted) return
            await (count > 0 ? Badge.set({ count }) : Badge.clear())
        })
        .catch(() => { })
}

/** After notifications are allowed: show the count that was skipped while they were not. */
export const reapplyNativeBadge = () => (wanted === undefined ? Promise.resolve() : setNativeBadge(wanted))
