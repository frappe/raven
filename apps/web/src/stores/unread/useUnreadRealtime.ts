import { useFrappeEventListener, useSWRConfig } from "frappe-react-sdk"
import { useDebounceCallback } from "usehooks-ts"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { channelUnreadStore } from "./store"
import { channelStore } from "@stores/channels/store"

/** Coalesce window for the delete reconcile — long enough that a batch delete (N separate
 *  events), or several deletes across channels, collapse into one refetch. */
const RECONCILE_DELAY = 1000

type UnreadChannelEvent = {
    channel_id: string
    sent_by: string
    event_type: "new_message" | "message_deleted" | "track_visit" | "mark_unread"
    /** Timestamp of the latest message in the channel - sent when creating or deleting a message */
    last_message_timestamp?: string
    /** JSON string of the new last message — present on DM message events. */
    last_message_details?: string
    /** True when a DM's last message was deleted and none remain — clear the lingering teaser. */
    last_message_cleared?: boolean
    is_dm_channel?: boolean
    is_thread?: boolean
    play_sound?: boolean
    /** Sent by the `track_visit` API when the client sends the latest message that the user has seen.
     *
     * Used to update the last visit timestamp for the channel for the user (channelUnreadStore)
     */
    last_visit?: string
    /** Sent by mark_channel_as_unread — the unread count to set directly on the badge. */
    unread_count?: number
}

/**
 * Single handler for the channel-activity signal. The event carries no count —
 * it's a "something changed in channel X" ping — and drives two independent
 * updates off the one subscription:
 *
 *  1. Unread counts (store). Someone else posted -> increment (the store applies
 *     the timestamp guard and exempts the channel being actively read). Our own
 *     post, or a read echoed from another device -> advance the watermark so this
 *     session agrees and later bumps below it are ignored. No per-event refetch
 *     (v2's slow path, which raced reads).
 *
 *  2. DM list preview (channelStore). DM message events carry the new
 *     last_message_details + timestamp, so the sidebar's preview text and date
 *     update live — patched straight into the channel store (single writer; the
 *     sidebar re-sorts by timestamp). Only events that actually carry details patch
 *     the channel — that excludes read-echoes (track_visit) and plain non-DM channel
 *     pings, neither of which should rewrite a channel's last-message fields.
 *
 * Thread activity rides a separate `thread_reply` event and its own unread count
 * (threads are excluded from get_unread_count_for_channels), so it isn't here.
 * 
 * * A "raven:unread_channel_count_updated" event is sent by the backend for a channel when:
 * 1. A new message is sent
 * 2. A message is deleted
 * 3. The user calls the track_visit API and this signal is broadcast to other tabs to update the last visit timestamp for the channel for the user
 * 
 * So when an event like this comes in - and it has details about the last message (complete in case of DMs - user scoped),
 * or just the timestamp in case of regular channels - we can update the last message timestamp for the channel in the channelStore for sorting
 * 
 * When an event comes in from someone else - it can either be because a new message was sent, or a message was deleted.
 * If a new message was sent - it's timestamp will definitely be greater than the last visit timestamp we have locally - so we can increment by one
 * If a message was deleted, the latest message timestamp sent by the server may or may not be greater than the last visit timestamp we have locally.
 * So we cannot increment by one in this case. Hence, the backend now sends the event_type as "message_deleted" in case of a message deletion.
 */
export const useUnreadRealtime = () => {
    const { name: currentUser } = useUserCookieData()
    const { mutate } = useSWRConfig()

    /**
     * A delete can't be safely decremented locally (the event lacks the deleted message's
     * timestamp on a last-delete, and the count is batch-distinct), so revalidate the
     * authoritative per-channel counts — the same fetch useUnreadSync runs (SWR key
     * "unread_channel_counts"), which reconciles the whole store. Debounced so a batch delete,
     * or several deletes across channels, collapse into one refetch.
     */
    const reconcileUnread = useDebounceCallback(() => mutate("unread_channel_counts"), RECONCILE_DELAY)

    useFrappeEventListener("raven:unread_channel_count_updated", (event: UnreadChannelEvent) => {
        if (!event?.channel_id) return

        // 1. Unread counts
        if (event.sent_by === currentUser) {
            // Mark-unread: deliberate backward watermark. markRead is forward-only and
            // would drop it, so route to markUnread with the server-computed count.
            if (event.event_type === "mark_unread" && event.last_visit) {
                channelUnreadStore.markUnread(event.channel_id, event.last_visit, event.unread_count ?? 0)
            } else if (event.last_visit) {
                channelUnreadStore.markRead(event.channel_id, event.last_visit, false)
            }

            if (event.event_type && event.event_type === "new_message" && event.last_message_timestamp) {
                channelUnreadStore.markRead(event.channel_id, event.last_message_timestamp, true)
            }
        } else {
            // If the event is published by someone else, then it could be because a new message was sent, or a message was deleted.
            if (event.event_type === "new_message") {
                // Only increment this if the user is a member of the channel
                if (channelStore.getChannel(event.channel_id)?.member_id) {
                    channelUnreadStore.increment(event.channel_id, event.last_message_timestamp)
                }
            } else if (event.event_type === "message_deleted") {
                // A delete can't be safely decremented locally (no deleted-message timestamp on a
                // last-delete; batch-distinct counting), so revalidate the authoritative counts
                // (debounced). Only worth it when we're a member AND currently show unread.
                if (channelStore.getChannel(event.channel_id)?.member_id && channelUnreadStore.getState(event.channel_id).count > 0) {
                    reconcileUnread()
                }
            }

        }

        // 2. DM list preview — only a real SEND carries the new message details (a JSON
        // string), and only then should we rewrite the channel's last-message fields. A
        // delete reuses this event with last_message_details=null and the DELETED message's
        // timestamp — patching that would null the preview and drag the DM's sort key
        // backward (it appears to "move down"), so a falsy details value is skipped.
        // This can be sent for both message created and deleted events
        // DMs will definitely have the last_message_details since they are user scoped
        if (event.last_message_details) {
            channelStore.patchChannel(event.channel_id, {
                last_message_details: event.last_message_details,
                ...(event.last_message_timestamp
                    ? { last_message_timestamp: event.last_message_timestamp }
                    : {}),
            })
        } else if (event.last_message_cleared) {
            // A DM's last (only) message was deleted and none remain — clear the lingering
            // preview + sort key live (the backend flags this explicitly because a null
            // details value alone is ambiguous with a non-last delete, which must NOT clear).
            channelStore.patchChannel(event.channel_id, {
                last_message_details: null,
                last_message_timestamp: undefined,
            })
        } else {
            // A regular channel's unread_channel_count_updated event will not have the last_message_details to prevent leaking messages to all users
            // But it will have the timestamp of the last message - which if we pass on to the channelStore, we can sort the channels by the last message timestamp
            // Not updating this for message deletions because message deletions can happen out of order (not the latest message) - 
            // and those would have the timestamp of the deleted message
            if (event.last_message_timestamp && event.event_type === "new_message") {
                channelStore.patchChannel(event.channel_id, {
                    last_message_timestamp: event.last_message_timestamp,
                })
            }
        }
    })
}
