import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { isRootPath, registerAndroidBack } from "./back"
import { subscribeLinkClicks } from "./links"
import { trackKeyboardInset } from "./keyboard"
import { toast } from "sonner"
import _ from "@lib/translate"
import { pendingNotice, pendingPath } from "./pending"
import { openNotificationTarget, subscribeForeignSiteNotifications, subscribeNotificationTaps, watchNotifications } from "./push"
import { subscribeShareDelivery } from "./shareIn"
import type { VersionNotice } from "./SitePicker"

/** Listeners that need the router: back, push taps, foreign pushes, share delivery, link clicks. */
export default function NativeBridge() {
    const navigate = useNavigate()

    useEffect(() => {
        let disposed = false
        // Flows that finish after an unmount route through this.
        const go = (path: string) => { if (!disposed) navigate(path) }
        // Browser router at /: the location is the route, read at press time so nothing re-renders here.
        const unBack = registerAndroidBack(() => isRootPath(window.location.pathname), () => navigate("/"))
        const unLinks = subscribeLinkClicks(navigate)
        const unKeyboard = trackKeyboardInset()
        const unTap = subscribeNotificationTaps((data) => { openNotificationTarget(data, go).catch(() => { }) })
        const unForeign = subscribeForeignSiteNotifications()
        void watchNotifications(true)
        // A page leaving takes its listeners with it, and this effect's cleanup does not run.
        const onLeave = () => { void watchNotifications(false) }
        window.addEventListener("pagehide", onLeave)
        const unShare = subscribeShareDelivery(go)
        pendingPath.take().then((path) => path && go(path))
        pendingNotice.take().then((stored) => {
            if (!stored || disposed) return
            const notice = JSON.parse(stored) as VersionNotice
            if (notice.kind === "mismatch") toast.warning(_("This site runs Raven {0}; the app is built for {1}. Some features may not work.", [notice.site, notice.app]), { duration: 8000 })
            else toast.warning(_("A newer Raven app is available for this site."), { duration: 8000 })
        }).catch(() => { })
        return () => {
            disposed = true
            window.removeEventListener("pagehide", onLeave)
            void watchNotifications(false)
            unBack(); unLinks(); unKeyboard(); unTap(); unForeign(); unShare()
        }
    }, [navigate])

    return null
}
