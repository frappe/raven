import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { consumePendingNotificationClick } from "@lib/push"

/**
 * Routes push-notification clicks client-side. sw.js can't navigate our pages
 * (its scope doesn't control them), so when a notification is clicked with an
 * app window already open it focuses the window and hands over the target URL
 * on TWO paths — both land here:
 *
 *  1. postMessage at click time — instant, works while the page is live
 *     (desktop, Android, foreground-adjacent states).
 *  2. Pull on resume — a backgrounded iOS PWA is FROZEN, so path 1's message
 *     dies in the suspended event loop. The SW holds the URL instead, and we
 *     consume it when the page becomes visible again (and once on mount, in
 *     case the resume beat the listener). Consuming clears it in the SW, so
 *     between the two paths a click navigates exactly once-ish (a duplicate
 *     navigate to the same route is a no-op for the router).
 */
export const usePushNotificationNavigation = () => {
    const navigate = useNavigate()

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return

        const navigateToUrl = (rawUrl: string) => {
            let target: URL
            try {
                target = new URL(rawUrl)
            } catch {
                return
            }
            if (target.origin !== window.location.origin) return

            // Strip the router basename (e.g. /raven) — navigate() re-adds it.
            let path = target.pathname
            const base = import.meta.env.VITE_BASE_NAME
            if (base && path.startsWith(`/${base}`)) path = path.slice(base.length + 1) || "/"

            navigate(path + target.search + target.hash)
        }

        const consumePending = () => {
            consumePendingNotificationClick().then((url) => {
                if (url) navigateToUrl(url)
            })
        }

        // Path 1: live-page delivery. Also consume, so the stored copy is cleared.
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== "raven:notification-click" || !event.data.url) return
            navigateToUrl(event.data.url)
            consumePendingNotificationClick()
        }

        // Path 2: frozen-page delivery — pull when the app thaws.
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") consumePending()
        }

        navigator.serviceWorker.addEventListener("message", onMessage)
        document.addEventListener("visibilitychange", onVisibilityChange)
        consumePending()
        return () => {
            navigator.serviceWorker.removeEventListener("message", onMessage)
            document.removeEventListener("visibilitychange", onVisibilityChange)
        }
    }, [navigate])
}
