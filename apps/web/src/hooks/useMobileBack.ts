import { useCallback, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useIsMobile } from "@hooks/use-mobile"

/**
 * Back action for mobile headers. Pops browser history when there's an in-app entry to
 * return to — so back always lands wherever the user actually came from (channel list,
 * DM list, notifications), matching the OS back-swipe. On a cold start (deep link / PWA
 * launched straight into a chat) there's no in-app history, so it uses `fallback`:
 * a route to go to, or a function (e.g. a pane's close handler).
 *
 * COLD ENTRIES also get their history stack repaired (mobile, string fallbacks only):
 * a push notification or shared link lands directly on the detail route with nothing
 * beneath it, so the chevron works (fallback) but the OS back-swipe — a plain
 * history.back() — does nothing. On mount, when this is the first in-app entry, we
 * replace it with the fallback route and push the current route back on top. Nothing
 * visible changes, but the swipe now has a real entry to pop to — and the chevron
 * takes the same navigate(-1) path, so both gestures behave identically.
 *
 * The repair matrix — what a cold entry gets synthesized beneath it, and which
 * header's instance of this hook does it:
 *
 *   Cold entry lands on          | Back entry beneath     | Repaired by
 *   -----------------------------|------------------------|---------------------------
 *   Channel                      | workspace list (/{ws}) | ChannelHeader
 *   DM                           | /dm-channel            | DMChannelHeader
 *   Chat-pane host's chat route  | the host's list        | the pane's channel/DM header
 *   Thread (channel or DM)       | /threads               | ThreadHeader
 *   Thread inside a pane host    | the host's list        | ThreadHeader
 *
 * On thread routes, two headers are mounted (the channel header sits COVERED under
 * the thread layer) — the covered one passes `repairStack: false` so the thread
 * header, whose parent route is right, is the one that repairs.
 */

/** Pages that host the chat pane as a CHILD ROUTE (`/<host>/:channelID/:messageID`,
 *  see NotificationChatRoute). Headers rendered under one of these use the host's
 *  list as the mobile-back fallback / cold-start repair target. */
export const PANE_HOSTS = ["/notifications", "/search", "/saved-messages"]
export function useMobileBack(
    fallback: string | (() => void),
    options?: {
        /** Opt OUT of the stack repair (default on). A header that's COVERED by
         *  another layer at mount (the channel header under a cold-started thread)
         *  passes false, so the visible layer's header — with the right parent
         *  route — is the one that repairs the stack. */
        repairStack?: boolean
    },
) {
    const navigate = useNavigate()
    const location = useLocation()
    const isMobile = useIsMobile()
    const repairStack = options?.repairStack ?? true

    useEffect(() => {
        if (!isMobile || !repairStack || typeof fallback !== "string") return
        // idx > 0 means there's already somewhere to go back to — nothing to repair.
        // (Also what makes this StrictMode-safe: the first run raises idx to 1.)
        if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) return
        navigate(fallback, { replace: true })
        navigate(location.pathname + location.search, { state: location.state })
        // Mount-only by design: a repair is only ever needed for the entry we landed on.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return useCallback(() => {
        // React Router tracks its position in history.state.idx — 0 means this is the
        // first in-app entry, and going back would leave the app.
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (idx > 0) {
            navigate(-1)
        } else if (typeof fallback === "function") {
            fallback()
        } else {
            navigate(fallback, { replace: true })
        }
    }, [navigate, fallback])
}
