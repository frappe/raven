import { db, type MessageWindow } from "@db"
import { siteOrigin } from "@lib/site"
import { mediaFolder } from "./mediaUrl"
import { nativePlugin } from "./platform"

// Contract of the RavenMedia plugin (apps/native/{android,ios}); the URL shape lives in mediaUrl.ts.
type RavenMediaPlugin = {
    setSession(options: { origin: string; token: string }): Promise<void>
    trim(options: { keep: string[]; budgetBytes: number }): Promise<void>
}
const media = nativePlugin<RavenMediaPlugin>("RavenMedia")

/** The handler only ever attaches the bearer to this origin. Called at boot and after every refresh. */
export const setMediaSession = async (token: string) => {
    const { plugin } = await media()
    await plugin.setSession({ origin: siteOrigin(), token }).catch(() => { })
}

const BUDGET_BYTES = 200 * 1024 * 1024
const TRIM_EVERY_MS = 60_000

/** Cache folders of every cached message's file, newest message first; the trim keeps from the front. */
export const mediaKeepOrder = (windows: MessageWindow[]): string[] => {
    // Frappe datetimes are fixed-width, so the string compare is chronological.
    const rows = windows.flatMap((w) => w.rows.map((m) => ({ creation: m.creation, file: "file" in m ? m.file : undefined })))
    const seen = new Set<string>()
    for (const row of rows.filter((r) => r.file).sort((a, b) => (a.creation < b.creation ? 1 : -1))) seen.add(mediaFolder(row.file as string).folder)
    return [...seen]
}

let lastTrim = 0
/** Eviction by message chronology: the oldest cached messages lose their media first. */
export const trimMediaCache = async () => {
    if (Date.now() - lastTrim < TRIM_EVERY_MS) return
    lastTrim = Date.now()
    const { plugin } = await media()
    await plugin.trim({ keep: mediaKeepOrder(await db.message_windows.toArray()), budgetBytes: BUDGET_BYTES }).catch(() => { })
}
