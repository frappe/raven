import { useContext, useEffect } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { catchUpNewerMessages, type FrappeCallClient } from "./loaders"
import { channelMessagesStore } from "./store"

/**
 * Realtime is best-effort: a disconnect drops the message events for every room we're in. On
 * reconnect, catch up the missed tail for each warm, live-edge channel — catchUpNewerMessages
 * fetches only messages newer than the loaded newest, merges them, and flips the window to
 * detached ("jump to present") if more than a page was missed; detached/idle windows are
 * skipped. The backstop behind the live subscriptions, so channel switches read instantly from
 * the store and only reconcile when a gap actually happened.
 *
 * The reconnect itself is driven both by socket.io's own recovery AND by useActiveSocketConnection,
 * which force-reconnects a socket that died while the tab was backgrounded (the case socket.io
 * doesn't always surface) — so this catch-up fires on those returns too.
 */
export const useReconnectCatchup = () => {
    const { socket, call } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        if (!socket) return
        const onReconnect = () => {
            const client = call as FrappeCallClient
            for (const channelID of channelMessagesStore.getHydratedChannelIDs()) {
                catchUpNewerMessages(client, channelID)
            }
        }
        socket.io.on("reconnect", onReconnect)
        return () => {
            socket.io.off("reconnect", onReconnect)
        }
    }, [socket, call])
}
