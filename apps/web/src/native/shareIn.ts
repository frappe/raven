// OS share-in on the web side: reading a warm share, and turning the shell's stash
// into what the ShareTarget page and the composer consume. The mapping itself is
// shared with the shell: @raven/lib/utils/shareIntent.
import { PENDING_SHARE_KEY, type PendingShare, type ShareIntent } from "@raven/lib/utils/shareIntent"
import { nativePlatform } from "./platform"
import { ravenShell } from "./shell"

export { intentToPendingShare, PENDING_SHARE_KEY, type PendingShare } from "@raven/lib/utils/shareIntent"

let sharedFiles: File[] = []

/** Android: MainActivity's SEND intent via the shell plugin. iOS: send-intent's share extension. */
export const readShareIntent = async (): Promise<ShareIntent | null> => {
    if (nativePlatform() === "android") {
        const { shell } = await ravenShell()
        const { intent } = await shell.getShareIntent()
        if (!intent) return null
        // The activity keeps its intent; forget it so no later read replays this share.
        await shell.clearShareIntent().catch(() => { })
        return intent
    }
    const { SendIntent } = await import("send-intent")
    // Rejects when no share is pending; the plugin marks a delivered share as processed itself.
    return SendIntent.checkSendIntentReceived().catch(() => null)
}

/** Fires when a share arrives while the app is open. iOS: send-intent's DOM event; Android: the shell plugin. */
export const subscribeShareReceived = (handler: () => void): (() => void) => {
    let disposed = false
    let handle: { remove: () => Promise<void> } | undefined
    window.addEventListener("sendIntentReceived", handler)
    if (nativePlatform() === "android") {
        ravenShell().then(async ({ shell }) => {
            const h = await shell.addListener("shareReceived", handler)
            if (disposed) { h.remove().catch(() => { }); return }
            handle = h
        }).catch(() => { })
    }
    return () => {
        disposed = true
        window.removeEventListener("sendIntentReceived", handler)
        handle?.remove().catch(() => { })
    }
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

/** Stashes a share for /share-target?native=1. */
export const stashPendingShare = async (share: PendingShare) => {
    const { Preferences } = await import("@capacitor/preferences")
    await Preferences.set({ key: PENDING_SHARE_KEY, value: JSON.stringify(share) })
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
            // Share payloads hand back percent-encoded content:// and file:// URIs.
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
