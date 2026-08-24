import { useContext, useEffect, useRef, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { channelMessagesStore } from "./store"

const ROOM_DOCTYPE = "Raven Channel"

// Stable references so useSyncExternalStore doesn't re-subscribe each render.
const subscribeHydrated = (onChange: () => void) => channelMessagesStore.subscribeHydrated(onChange)
const getHydratedSnapshot = () => channelMessagesStore.getHydratedChannelIDs()

/** Reactive, reference-stable list of channels the messages store keeps warm. */
const useHydratedChannels = (): readonly string[] =>
    useSyncExternalStore(subscribeHydrated, getHydratedSnapshot)

/**
 * Keeps socket-room subscriptions in sync with a set of channels. Rolled by hand
 * instead of the SDK's useFrappeDocumentEventListener because:
 *   - one hook diffs the whole set (subscribe added, unsubscribe removed). A
 *     doc_subscribe triggers a backend permission check, so subscribing once per
 *     channel and keeping it avoids re-checking on every channel switch.
 *   - we skip doc_open / doc_close (viewer presence) — pure overhead for channels
 *     we keep warm but aren't actively viewing.
 *   - the reconnect re-subscription is registered once and cleaned up (the SDK
 *     hook adds a reconnect handler it never removes).
 *
 * `channelIDs` must be reference-stable when unchanged (it is — the store's
 * hydrated snapshot), so the diff effect only runs on actual membership change.
 */
const useChannelRoomSubscriptions = (channelIDs: readonly string[]) => {
    const { socket } = useContext(FrappeContext) as FrappeConfig
    const subscribed = useRef<Set<string>>(new Set())

    // Diff desired vs. currently-subscribed rooms.
    useEffect(() => {
        if (!socket) return
        const desired = new Set(channelIDs)
        for (const id of desired) {
            if (!subscribed.current.has(id)) {
                socket.emit("doc_subscribe", ROOM_DOCTYPE, id)
                subscribed.current.add(id)
            }
        }
        for (const id of [...subscribed.current]) {
            if (!desired.has(id)) {
                socket.emit("doc_unsubscribe", ROOM_DOCTYPE, id)
                subscribed.current.delete(id)
            }
        }
    }, [socket, channelIDs])

    // Rooms are dropped on disconnect — rejoin the whole set on reconnect.
    useEffect(() => {
        if (!socket) return
        const onReconnect = () => {
            for (const id of subscribed.current) socket.emit("doc_subscribe", ROOM_DOCTYPE, id)
        }
        socket.io.on("reconnect", onReconnect)
        return () => {
            socket.io.off("reconnect", onReconnect)
        }
    }, [socket])

    // Leave all rooms on unmount (or when the socket itself changes — the cleared
    // set then lets the diff effect re-subscribe from scratch on the new socket).
    useEffect(() => {
        const joined = subscribed.current
        return () => {
            for (const id of joined) socket?.emit("doc_unsubscribe", ROOM_DOCTYPE, id)
            joined.clear()
        }
    }, [socket])
}

/**
 * Mounted once at the app shell: keeps message-room subscriptions in sync with
 * the channels the store keeps warm, so those channels receive live message
 * events even after the user has navigated away from them.
 */
export const useMessageRoomSubscriptions = () => {
    useChannelRoomSubscriptions(useHydratedChannels())
}
