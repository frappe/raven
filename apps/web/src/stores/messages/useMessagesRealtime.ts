import { useFrappeEventListener } from "frappe-react-sdk"
import type { Message } from "@raven/types/common/Message"
import { channelMessagesStore } from "./store"
import { broadcastMessageEvent } from "./messageEvents"

type CreatedEvent = { channel_id: string; sender: string; message_id: string; message_details: Message }
type EditedEvent = { channel_id: string; sender: string; message_id: string; message_details: Partial<Message> }
type DeletedEvent = { channel_id: string; sender: string; message_id: string }
type ReactedEvent = { channel_id: string; sender: string; message_id: string; reactions: string }
/** Personal save flag — sent to the user (not a channel room), but carries channel_id for routing. */
type SavedEvent = { channel_id: string; message_id: string; liked_by: string }

/**
 * App-level dispatcher of live message events into channelMessagesStore. Mounted
 * once; it fires for every channel whose room we've joined (see
 * useMessageRoomSubscriptions) — not just the open one — which is how warm
 * channels stay current after the user navigates away.
 *
 * Events for channels the store isn't holding are ignored: an in-flight event for
 * a just-evicted channel must not lazily resurrect a bogus single-message window
 * (the store's action methods getState, which would insert it). The reducers
 * handle the rest — insert only at the live edge, drop stale versions by
 * `modified`, no-op on unknown ids.
 */
export const useMessagesRealtime = () => {
    useFrappeEventListener("message_created", (event: CreatedEvent) => {
        if (!event?.message_details) return
        // Rebroadcast for in-app subscribers (see messageEvents) — BEFORE the
        // store guards below: those exist for the message window (hydration,
        // own-send dedupe), and subscribers like the files tab want every
        // event, own sends included.
        broadcastMessageEvent({
            kind: "created",
            channelID: event.channel_id,
            messageID: event.message_id,
            messageType: event.message_details.message_type,
        })
        if (!channelMessagesStore.isHydrated(event.channel_id)) return
        // This is our own send coming back over the broadcast (the server sends every
        // new message to everyone in the channel, us included). It's already on screen,
        // so ignore this copy — the server's direct response to our send handles it.
        if (channelMessagesStore.isPendingSend(event.message_details.message_batch_id ?? "")) return
        channelMessagesStore.messageCreated(event.channel_id, event.message_details)
    })

    useFrappeEventListener("message_edited", (event: EditedEvent) => {
        if (!event?.message_id || !channelMessagesStore.isHydrated(event.channel_id)) return
        channelMessagesStore.messageEdited(event.channel_id, event.message_id, event.message_details ?? {})
    })

    useFrappeEventListener("message_deleted", (event: DeletedEvent) => {
        if (!event?.message_id) return
        broadcastMessageEvent({ kind: "deleted", channelID: event.channel_id, messageID: event.message_id })
        if (!channelMessagesStore.isHydrated(event.channel_id)) return
        channelMessagesStore.messageDeleted(event.channel_id, event.message_id)
    })

    useFrappeEventListener("message_reacted", (event: ReactedEvent) => {
        if (!event?.message_id || !channelMessagesStore.isHydrated(event.channel_id)) return
        channelMessagesStore.reactionsUpdated(event.channel_id, event.message_id, event.reactions)
    })

    useFrappeEventListener("message_saved", (event: SavedEvent) => {
        if (!event?.message_id || !channelMessagesStore.isHydrated(event.channel_id)) return
        channelMessagesStore.savedUpdated(event.channel_id, event.message_id, event.liked_by)
    })
}
