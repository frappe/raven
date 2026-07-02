import { FrappeConfig, FrappeContext, useSWR } from "frappe-react-sdk"
import { useContext, useRef } from "react"
import { toast } from "sonner"
import _ from "@lib/translate"

/**
 * Keeps the realtime socket alive. SWR revalidates `socket_health` on window focus (and on
 * network reconnect / its interval), and the "fetcher" just asserts `socket.connected` — so each
 * focus is a cheap health check, not a request. If the socket died (common after a backgrounded
 * tab throttles or suspends it — where socket.io often does NOT surface a clean reconnect), we
 * force `socket.connect()`; socket.io then fires `reconnect`, which `useReconnectCatchup` uses to
 * pull any messages missed during the gap. After repeated failures we surface a toast.
 *
 * Ported from v2 (frontend/src/hooks/useActiveSocketConnection). Mounted once in AppListeners.
 */
export const useActiveSocketConnection = () => {
    const { socket } = useContext(FrappeContext) as FrappeConfig
    const failureCount = useRef(0)
    const toastShown = useRef(false)

    useSWR(
        "socket_health",
        () => (socket?.connected ? true : Promise.reject(new Error("Socket not connected"))),
        {
            onSuccess: () => {
                failureCount.current = 0
                toastShown.current = false
            },
            onError: () => {
                // After a couple of failed reconnect attempts, tell the user realtime is down.
                if (failureCount.current >= 2) {
                    if (!toastShown.current) {
                        toast.error(_("Realtime events aren't working. Please refresh the page."), {
                            duration: 5000,
                            closeButton: true,
                            id: "socket-connection-error",
                        })
                        toastShown.current = true
                    }
                } else {
                    // Otherwise force a reconnect — the resulting `reconnect` event drives the
                    // missed-message catch-up (useReconnectCatchup).
                    socket?.connect()
                    failureCount.current += 1
                }
            },
            errorRetryCount: 3,
        },
    )
}
