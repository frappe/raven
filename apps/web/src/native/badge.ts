// Native icon-badge adapter. Dynamic import so browser bundles stay Capacitor-free.
// On iOS the plugin asks for notification permission before every write; the one prompt
// belongs to push (initNativePush), so the badge waits until notifications are allowed.
// Once granted, the system never returns to "not asked", so the check is not repeated.
let granted = false

export const setNativeBadge = (count: number): Promise<void> =>
    import("@capawesome/capacitor-badge")
        .then(async ({ Badge }) => {
            granted ||= (await Badge.checkPermissions()).display === "granted"
            if (!granted) return
            await (count > 0 ? Badge.set({ count }) : Badge.clear())
        })
        .catch(() => { })
