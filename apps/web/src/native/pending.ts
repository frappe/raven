import { withPrefs } from "./platform"

/** A value that survives one reload: set before it, taken once after it. */
export const pending = (key: string) => ({
    set: (value: string) => withPrefs((p) => p.set({ key, value })),
    /** Reads without taking: the picker words itself by a share that the app, once open, still has to take. */
    peek: (): Promise<string | null> => withPrefs((p) => p.get({ key })).then(({ value }) => value ?? null),
    take: async (): Promise<string | null> => {
        const { value } = await withPrefs((p) => p.get({ key }))
        if (value) await withPrefs((p) => p.remove({ key }))
        return value ?? null
    },
})

/** Route to open after the reload a push tap to another site or a share on the picker causes. */
export const pendingPath = pending("pendingPath")
/** A browser link to a site that wasn't saved: the picker offers the site, and the page opens once it's signed in. */
export const pendingLink = pending("pendingLink")
/** A warning to toast once the app is up (version mismatch, update prompt). */
export const pendingNotice = pending("pendingNotice")
/** Site whose session died: the picker signs it in again on mount. */
export const pendingRelogin = pending("pendingRelogin")
