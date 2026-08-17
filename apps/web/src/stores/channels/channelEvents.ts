/**
 * In-app fan-out of the `channel_list_updated` realtime event.
 *
 * Same reason as messageEvents: useFrappeEventListener's cleanup calls
 * socket.off(event) WITHOUT the handler, removing every listener for that
 * event — so only ONE component may subscribe to a given socket event. That
 * one place is useChannelListRealtime (app-level, always mounted). Anything
 * else that needs to react to a channel update (the Pins tab refetching after
 * a pin/unpin commits) subscribes HERE, and unmounting only removes its own
 * callback.
 *
 * Consumers get the after-commit signal (the event is published after_commit),
 * NOT the optimistic store patch — so a refetch on it sees the committed state.
 */

type Listener = (channelID: string) => void

const listeners = new Set<Listener>()

/** Called by useChannelListRealtime only — the single socket subscriber. */
export const broadcastChannelListUpdated = (channelID: string) => {
	listeners.forEach((listener) => listener(channelID))
}

/** Subscribe to rebroadcast channel-update events. Returns the unsubscribe. */
export const subscribeToChannelListUpdated = (listener: Listener) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}
