import { Preferences } from "@capacitor/preferences"
import { SendIntent } from "send-intent"

export const PENDING_SHARE_KEY = "pendingShare"
export const HANDLED_SHARE_KEY = "handledShare"

// Mirror of apps/web/src/native/shareIn.ts shareSignature — keep in sync.
export const shareSignature = (intent: { title?: string; description?: string; type?: string; url?: string }) =>
    JSON.stringify([intent.title ?? "", intent.description ?? "", intent.type ?? "", intent.url ?? ""])

type PendingShare = {
    title?: string
    text?: string
    url?: string
    files?: { uri: string; type?: string; name?: string }[]
}

const isHttpUrl = (value: string | undefined) => !!value && /^https?:\/\//i.test(value)

// Mirror of apps/web/src/native/shareIn.ts intentToPendingShare — keep in sync.
const intentToPendingShare = (intent: { title?: string; description?: string; type?: string; url?: string }): PendingShare | null => {
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

/** Stashes the pending share in Preferences; true when one was captured. */
export const captureShareIntent = async (): Promise<boolean> => {
    try {
        const intent = await SendIntent.checkSendIntentReceived()
        const payload = intentToPendingShare(intent)
        if (!payload) return false
        const sig = shareSignature(intent)
        const { value: handled } = await Preferences.get({ key: HANDLED_SHARE_KEY })
        if (handled === sig) return false
        // The activity keeps its last intent; skip one we already handled.
        await Preferences.set({ key: PENDING_SHARE_KEY, value: JSON.stringify(payload) })
        await Preferences.set({ key: HANDLED_SHARE_KEY, value: sig })
        return true
    } catch {
        // Rejects when no share is pending.
        return false
    }
}
