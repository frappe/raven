/**
 * In-app fan-out of live message events.
 *
 * Why this exists: useFrappeEventListener's cleanup calls socket.off(event)
 * WITHOUT the handler, which removes every listener for that event — so only
 * ONE component in the app may ever subscribe to a given socket event. That
 * one place is useMessagesRealtime (app-level, always mounted). Anything else
 * that cares about message events (the channel files tab refreshing on a new
 * upload) subscribes HERE, and unmounting only removes its own callback.
 */

export type LocalMessageEvent =
	| { kind: "created"; channelID: string; messageID: string; messageType?: string }
	| { kind: "deleted"; channelID: string; messageID: string }

type Listener = (event: LocalMessageEvent) => void

const listeners = new Set<Listener>()

/** Called by useMessagesRealtime only — the single socket subscriber. */
export const broadcastMessageEvent = (event: LocalMessageEvent) => {
	listeners.forEach((listener) => listener(event))
}

/** Subscribe to rebroadcast message events. Returns the unsubscribe. */
export const subscribeToMessageEvents = (listener: Listener) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}
