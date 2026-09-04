import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { isNative } from "./platform"
import { resolveNotificationTarget, subscribeNotificationTaps } from "./push"
import { registerAndroidBack } from "./back"
import { intentToPendingShare, readShareIntent, stashPendingShare, subscribeShareReceived } from "./shareIn"

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
        // Warm-start shares: the app is already open when the user shares into it,
        // so the shell's cold-start capture never runs; deliver it from here.
        const deliverShare = async () => {
            try {
                const intent = await readShareIntent()
                const share = intent && intentToPendingShare(intent)
                if (disposed || !share) return
                await stashPendingShare(share)
                if (disposed) return
                navigate("/share-target?native=1")
            } catch {
                // Nothing pending, or the plugin is unavailable.
            }
        }
        const unShare = subscribeShareReceived(deliverShare)
        // A share can arrive while no page listens (picker, boot, login reload). The
        // plugin holds it, so re-read on mount and on every foreground.
        deliverShare()
        let unAppState: (() => void) | undefined
        import("@capacitor/app").then(async ({ App }) => {
            if (disposed) return
            const handle = await App.addListener("appStateChange", ({ isActive }) => {
                if (isActive) deliverShare()
            })
            if (disposed) { handle.remove().catch(() => { }); return }
            unAppState = () => handle.remove().catch(() => { })
        }).catch(() => { })
        return () => {
            disposed = true
            unBack()
            unTap()
            unShare()
            unAppState?.()
        }
    }, [navigate])
}
