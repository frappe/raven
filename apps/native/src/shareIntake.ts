import { Capacitor } from "@capacitor/core"
import { Preferences } from "@capacitor/preferences"
import { SendIntent } from "send-intent"
import { intentToPendingShare, PENDING_SHARE_KEY, type ShareIntent } from "@raven/lib/utils/shareIntent"
import { RavenShell } from "./shell"

/** Android: MainActivity's SEND intent via the shell plugin. iOS: send-intent's share extension. */
export const readShareIntent = async (): Promise<ShareIntent | null> => {
    if (Capacitor.getPlatform() === "android") {
        const { intent } = await RavenShell.getShareIntent()
        if (!intent) return null
        // The activity keeps its intent; forget it so no later read replays this share.
        await RavenShell.clearShareIntent().catch(() => { })
        return intent
    }
    // Rejects when no share is pending; the plugin marks a delivered share as processed itself.
    return SendIntent.checkSendIntentReceived().catch(() => null)
}

/** Stashes the pending share in Preferences; true when one was captured. */
export const captureShareIntent = async (): Promise<boolean> => {
    const intent = await readShareIntent().catch(() => null)
    const payload = intent && intentToPendingShare(intent)
    if (!payload) return false
    await Preferences.set({ key: PENDING_SHARE_KEY, value: JSON.stringify(payload) })
    return true
}
