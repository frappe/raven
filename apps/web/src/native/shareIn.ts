// OS share-in on the page: reading a share from the plugins and turning it into what
// the ShareTarget page and the composer consume.
import { stashSharedFiles } from "@components/features/ChatInput/sharedFiles"
import { intentToPendingShare, PENDING_SHARE_KEY, type PendingShare, type ShareIntent } from "./shareIntent"
import { listenNative, nativePlatform, withPrefs } from "./platform"
import { ravenShell } from "./shell"

/** Where a stashed share is consumed. */
export const SHARE_TARGET_PATH = "/share-target?native=1"

/** Android: MainActivity's SEND intent via the shell plugin. iOS: send-intent's share extension. */
const readShareIntent = async (): Promise<ShareIntent | null> => {
    if (nativePlatform() === "android") {
        const { plugin: shell } = await ravenShell()
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

/** A share arriving while the app is open. iOS: send-intent's DOM event; Android: the shell plugin. */
const subscribeShareReceived = (handler: () => void): (() => void) => {
    window.addEventListener("sendIntentReceived", handler)
    const unNative = nativePlatform() === "android"
        ? listenNative(async () => (await ravenShell()).plugin.addListener("shareReceived", handler))
        : () => { }
    return () => {
        window.removeEventListener("sendIntentReceived", handler)
        unNative()
    }
}

/** Moves a share the plugin holds into the stash; false when none is pending. */
export const stashIncomingShare = async (): Promise<boolean> => {
    const intent = await readShareIntent().catch(() => null)
    const share = intent && intentToPendingShare(intent)
    if (!share) return false
    await withPrefs((p) => p.set({ key: PENDING_SHARE_KEY, value: JSON.stringify(share) }))
    return true
}

// One delivery at a time: the plugin event and the foreground resume can both fire.
let delivering: Promise<void> | null = null
const deliverPendingShare = (navigate: (path: string) => void) =>
    (delivering ??= stashIncomingShare()
        .then((stashed) => { if (stashed) navigate(SHARE_TARGET_PATH) })
        .finally(() => { delivering = null }))

/** Delivers held shares: now, on the plugin's event, and on every return to the foreground. */
export const subscribeShareDelivery = (navigate: (path: string) => void): (() => void) => {
    const deliver = () => { deliverPendingShare(navigate).catch(() => { }) }
    const unShare = subscribeShareReceived(deliver)
    const unAppState = listenNative(async () => (await import("@capacitor/app")).App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) deliver()
    }))
    // A share can arrive while no page listens; the plugin holds it until read.
    deliver()
    return () => { unShare(); unAppState() }
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

/** The stashed share as the page's params, its files queued for the composer; empty when none. */
export const loadNativeShare = async (): Promise<URLSearchParams> => {
    const share = await takePendingShare()
    if (!share) return new URLSearchParams()
    stashSharedFiles(await readNativeFiles(share.files ?? []))
    return pendingShareToParams(share)
}

/** Reads and clears the share the shell stashed for us. */
const takePendingShare = async (): Promise<PendingShare | null> => {
    const { value } = await withPrefs((p) => p.get({ key: PENDING_SHARE_KEY }))
    if (!value) return null
    await withPrefs((p) => p.remove({ key: PENDING_SHARE_KEY }))
    try {
        return JSON.parse(value) as PendingShare
    } catch {
        return null
    }
}

/** Reads each native uri into a File through the WebView's file route: bytes arrive as a Blob, never base64. */
export const readNativeFiles = async (files: NonNullable<PendingShare["files"]>): Promise<File[]> => {
    if (!files.length) return []
    const { Capacitor } = await import("@capacitor/core")
    const read: File[] = []
    // One at a time: each file passes through memory whole, and a pick can hold several large videos.
    for (const f of files) {
        try {
            // The uri stays percent-encoded as the plugins hand it over: decoded, a # ? or % of the file name reads as URL syntax.
            const response = await fetch(Capacitor.convertFileSrc(f.uri))
            // Status 0 is a success here: Capacitor's iOS route answers video and audio without an HTTP status.
            if (!response.ok && response.status !== 0) continue
            read.push(new File([await response.blob()], f.name ?? "shared", { type: f.type ?? "application/octet-stream" }))
        } catch { /* an unreadable file is dropped; the rest still attach */ }
    }
    return read
}
