// OS share-in payload: the single source of truth for mapping a native
// send-intent into what the ShareTarget page and the composer consume.

export type PendingShare = {
    title?: string
    text?: string
    url?: string
    files?: { uri: string; type?: string; name?: string }[]
}

/** Shape of the send-intent plugin's `checkSendIntentReceived()` result. */
export type IntentLike = { title?: string; description?: string; type?: string; url?: string }

export const PENDING_SHARE_KEY = "pendingShare"
export const HANDLED_SHARE_KEY = "handledShare"

/** Stable fingerprint of a send-intent, used to skip re-delivered intents. */
export const shareSignature = (intent: IntentLike): string =>
    JSON.stringify([intent.title ?? "", intent.description ?? "", intent.type ?? "", intent.url ?? ""])

let sharedFiles: File[] = []

const isHttpUrl = (value: string | undefined) => !!value && /^https?:\/\//i.test(value)

// text/* (or missing type) → text + url; anything else with a url → a file.
// Null when nothing usable (no description and no url).
export const intentToPendingShare = (intent: IntentLike): PendingShare | null => {
    const { title, description, type, url } = intent
    if (!type || type.startsWith("text/")) {
        const text = description ?? undefined
        const httpUrl = isHttpUrl(url) ? url : undefined
        if (!text && !httpUrl) return null
        return { title: title ?? undefined, text, url: httpUrl }
    }
    if (!url) return null
    return { title: title ?? undefined, files: [{ uri: url, type, name: title ?? "shared" }] }
}

/** Maps a PendingShare to the ?title&text&url contract ShareTarget parses. */
export const pendingShareToParams = (share: PendingShare): URLSearchParams => {
    const p = new URLSearchParams()
    p.set("title", share.title ?? "")
    p.set("text", share.text ?? "")
    p.set("url", share.url ?? "")
    p.set("files", String(share.files?.length ?? 0))
    p.set("names", (share.files ?? []).map((f) => f.name ?? "shared").join(", "))
    return p
}

/** Reads and clears the share the shell stashed for us. */
export const takePendingShare = async (): Promise<PendingShare | null> => {
    const { Preferences } = await import("@capacitor/preferences")
    const { value } = await Preferences.get({ key: PENDING_SHARE_KEY })
    if (!value) return null
    await Preferences.remove({ key: PENDING_SHARE_KEY })
    try {
        return JSON.parse(value) as PendingShare
    } catch {
        return null
    }
}

/** Reads each shared uri from native storage into a File. */
export const readSharedFiles = async (share: PendingShare): Promise<File[]> => {
    if (!share.files?.length) return []
    const { Filesystem } = await import("@capacitor/filesystem")
    const results = await Promise.allSettled(
        share.files.map(async (f) => {
            // send-intent hands back percent-encoded content:// and file:// URIs.
            const { data } = await Filesystem.readFile({ path: decodeURIComponent(f.uri) })
            const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0))
            return new File([bytes], f.name ?? "shared", { type: f.type ?? "application/octet-stream" })
        }),
    )
    return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
}

// Module-level queue: ShareTarget stashes the files, the channel composer
// consumes them on mount. Emptied on read.
export const stashSharedFiles = (files: File[]) => {
    sharedFiles = files
}
export const consumeSharedFiles = (): File[] => {
    const files = sharedFiles
    sharedFiles = []
    return files
}
