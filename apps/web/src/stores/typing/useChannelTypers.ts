import { useCallback, useContext, useEffect, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext, useFrappeEventListener } from "frappe-react-sdk"
import { typingStore } from "./store"

const ROOM_DOCTYPE = "Raven Channel"

type TypersEvent = { channel: string; users: string[] }

/**
 * Live list of users typing in a channel (works for threads too — a thread IS
 * a channel).
 *
 * The realtime server broadcasts `raven_channel_typers` to the channel's
 * open_doc room — the VIEWERS room, deliberately NOT the doc_subscribe room
 * the message store keeps warm for background channels: typing is only visible
 * in the open channel, so only actual viewers receive the traffic. Hence this
 * hook (mounted by the indicator, which lives with the active composer):
 *   - joins on mount via doc_open, leaves via doc_close
 *   - seeds via raven_channel_get_typers (the server replies only to this user)
 *   - re-joins + re-seeds on reconnect (rooms are dropped on disconnect)
 *   - applies every typers event to the store, keyed by the EVENT's channel
 *     (not ours — a channel + thread pair can both be listening)
 */
export const useChannelTypers = (channelID: string): readonly string[] => {
    const { socket } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        if (!socket || !channelID) return
        const join = () => {
            socket.emit("doc_open", ROOM_DOCTYPE, channelID)
            socket.emit("raven_channel_get_typers", channelID)
        }
        join()
        socket.io.on("reconnect", join)
        return () => {
            socket.io.off("reconnect", join)
            socket.emit("doc_close", ROOM_DOCTYPE, channelID)
            // Drop the list so a stale "X is typing" isn't shown on returning later.
            typingStore.setTypers(channelID, [])
        }
    }, [socket, channelID])

    useFrappeEventListener("raven_channel_typers", (event: TypersEvent) => {
        if (event?.channel) typingStore.setTypers(event.channel, event.users ?? [])
    })

    const subscribe = useCallback(
        (onChange: () => void) => typingStore.subscribe(channelID, onChange),
        [channelID],
    )
    return useSyncExternalStore(subscribe, () => typingStore.getTypers(channelID))
}
