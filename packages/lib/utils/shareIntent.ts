// OS share-in payload, shared by the Capacitor shell (cold-start capture) and the
// web app (warm shares + the /share-target page). Pure: no Capacitor imports.

/** One item of a send-intent result: text lives in `description`, files in `url`. */
export type ShareItem = { title?: string; description?: string; type?: string; url?: string }

/** Shape of `SendIntent.checkSendIntentReceived()` / `RavenShell.getShareIntent()`. */
export type ShareIntent = ShareItem & { additionalItems?: ShareItem[] }

export type PendingShare = {
    title?: string
    text?: string
    url?: string
    files?: { uri: string; type?: string; name?: string }[]
}

/** Preferences key the shell stashes a share under; the web app takes it on /share-target?native=1. */
export const PENDING_SHARE_KEY = "pendingShare"

/** In-app route that consumes the stash. */
export const SHARE_TARGET_PATH = "/raven/share-target?native=1"

const isHttpUrl = (value: string | undefined) => !!value && /^https?:\/\//i.test(value)

// text/* (or missing type) → text + url; anything else with a url → files.
// Null when nothing usable (no description and no url).
export const intentToPendingShare = (intent: ShareIntent): PendingShare | null => {
    const { title, description, type, url } = intent
    if (!type || type.startsWith("text/")) {
        const text = description ?? undefined
        const httpUrl = isHttpUrl(url) ? url : undefined
        if (!text && !httpUrl) return null
        return { title: title ?? undefined, text, url: httpUrl }
    }
    // Plain loop: the shell targets old WebViews, and flatMap needs Chrome 69+.
    const files: NonNullable<PendingShare["files"]> = []
    for (const item of [intent, ...(intent.additionalItems ?? [])]) {
        if (item.url) files.push({ uri: item.url, type: item.type ?? type, name: item.title ?? "shared" })
    }
    if (files.length === 0) return null
    return { title: title ?? undefined, files }
}
