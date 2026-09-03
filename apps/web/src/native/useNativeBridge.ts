// src/native/useNativeBridge.ts
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { isNative } from "./platform"
import { resolveNotificationTarget, subscribeNotificationTaps } from "./push"
import { registerAndroidBack } from "./back"
import { intentToPendingShare, HANDLED_SHARE_KEY, PENDING_SHARE_KEY, shareSignature } from "./shareIn"

export const useNativeBridge = () => {
    const navigate = useNavigate()
    useEffect(() => {
        if (!isNative()) return
        let disposed = false
        const unBack = registerAndroidBack()
        const unTap = subscribeNotificationTaps((data) => {
            const target = resolveNotificationTarget(data, window.location.origin)
            if (!target) return
            if (target.kind === "same-site") navigate(target.path)
            else window.location.href = target.url
        })
        let unAppState: (() => void) | undefined
        // Warm-start shares: the app is already open when the user shares into
        // it, so the cold-start intent never fires — catch it on foreground.
        const captureWarmShare = async () => {
            try {
                const { SendIntent } = await import("send-intent")
                if (disposed) return
                const intent = await SendIntent.checkSendIntentReceived()
                if (disposed) return
                const share = intentToPendingShare(intent)
                if (disposed || !share) return
                const { Preferences } = await import("@capacitor/preferences")
                if (disposed) return
                const sig = shareSignature(intent)
                const { value: handled } = await Preferences.get({ key: HANDLED_SHARE_KEY })
                if (disposed || handled === sig) return
                // The activity keeps its last intent; skip one we already handled.
                await Preferences.set({ key: PENDING_SHARE_KEY, value: JSON.stringify(share) })
                await Preferences.set({ key: HANDLED_SHARE_KEY, value: sig })
                if (disposed) return
                navigate("/share-target?native=1")
            } catch {
                // checkSendIntentReceived rejects when no share is pending.
            }
        }
        import("@capacitor/app").then(async ({ App }) => {
            if (disposed) return
            const handle = await App.addListener("appStateChange", ({ isActive }) => {
                if (isActive) captureWarmShare()
            })
            if (disposed) { handle.remove().catch(() => { }); return }
            unAppState = () => handle.remove().catch(() => { })
        })
        return () => {
            disposed = true
            unBack()
            unTap()
            unAppState?.()
        }
    }, [navigate])
}
