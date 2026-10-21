// OS share-in payload shared by the plugins' intake and the /share-target page. Pure: no Capacitor imports.

/** One item of a share: text lives in `description`, a file in `url`. */
export type ShareItem = { title?: string; description?: string; type?: string; url?: string }

/** Shape of `SendIntent.checkSendIntentReceived()` (iOS) and `RavenShell.getShareIntent()` (Android). */
export type ShareIntent = ShareItem & { additionalItems?: ShareItem[] }

export type PendingShare = {
    title?: string
    text?: string
    url?: string
    files?: { uri: string; type?: string; name?: string }[]
}

/** Preferences key a share waits under until /share-target?native=1 takes it. */
export const PENDING_SHARE_KEY = "pendingShare"

const isHttpUrl = (value: string | undefined) => !!value && /^https?:\/\//i.test(value)

// A non-http url is a file, whatever the MIME type says (a shared .txt arrives as text/plain).
// Text and an http link ride along when present. Null when nothing usable.
export const intentToPendingShare = (intent: ShareIntent): PendingShare | null => {
    const { title, description, type, url } = intent
    const files = [intent, ...(intent.additionalItems ?? [])].flatMap((item) =>
        item.url && !isHttpUrl(item.url) ? [{ uri: item.url, type: item.type ?? type, name: item.title ?? "shared" }] : [])
    const text = description || undefined
    const httpUrl = isHttpUrl(url) ? url : undefined
    if (!files.length && !text && !httpUrl) return null
    // No title with files: the OS puts the file name there, and the page would post it as text.
    return { title: files.length ? undefined : title || undefined, text, url: httpUrl, files: files.length ? files : undefined }
}
