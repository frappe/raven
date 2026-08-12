import { useContext, useEffect } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { bumpConnectionEpoch } from "@stores/connectionFreshness"

/** How long the app must be hidden before we assume the phone froze it. iOS suspends
 *  a backgrounded PWA within seconds and kills the socket without telling us — and
 *  right after waking, the socket still LOOKS connected for a few more seconds, so
 *  checking `socket.connected` here would lie. Time hidden is the reliable signal.
 *  A quick app-switch stays under 30s; and if a short hide really did kill the
 *  socket, the reconnect listener below catches that case anyway. */
const FROZEN_AFTER_MS = 30_000

/**
 * Watches for every way the realtime connection can break, and bumps the break
 * counter (stores/connectionFreshness) when one happens:
 *
 *  - the socket reconnects → there was definitely a gap
 *  - the browser comes back online → we were definitely offline
 *  - the app becomes visible after 30s+ hidden → the phone likely froze us (above)
 *  - the page is restored from the back/forward cache → it was frozen mid-flight
 *
 * Mounted once in AppShell. This only MARKS windows as suspect — channel message
 * windows AND the notifications/threads list views, all of which are kept live by
 * socket events. The actual refetch happens per window when it's next looked at
 * (or immediately for the ones on screen). So a reconnect with 20 channels and a
 * handful of list views warm in memory doesn't fan out a request each; only what
 * the user actually looks at gets one.
 */
export const useConnectionFreshness = () => {
    const { socket } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        const bump = () => bumpConnectionEpoch()

        let hiddenAt: number | null = null
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now()
            } else {
                if (hiddenAt !== null && Date.now() - hiddenAt >= FROZEN_AFTER_MS) bump()
                hiddenAt = null
            }
        }
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) bump()
        }

        window.addEventListener("online", bump)
        document.addEventListener("visibilitychange", onVisibility)
        window.addEventListener("pageshow", onPageShow)
        socket?.io.on("reconnect", bump)
        return () => {
            window.removeEventListener("online", bump)
            document.removeEventListener("visibilitychange", onVisibility)
            window.removeEventListener("pageshow", onPageShow)
            socket?.io.off("reconnect", bump)
        }
    }, [socket])
}
