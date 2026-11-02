import { useCallback, useContext } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { toast } from "sonner"
import { errorResponseToast } from "@components/ui/error-banner"
import _ from "@lib/translate"
import { channelUnreadStore } from "./store"

/**
 * Mark a channel unread — from a specific message (the anchor and everything
 * after become unread) or, with no messageID, from the channel's latest message.
 *
 * The server returns the new watermark and count, and also publishes them as the
 * realtime `mark_unread` event to all of this user's sessions. Both go through
 * channelUnreadStore.markUnread, so whichever lands second is a no-op, and a
 * missed event can't leave the read tracker's baseline ahead of the server.
 *
 * The success toast is the only immediate feedback on mobile, where the sidebar
 * badge isn't visible from inside a channel.
 */
export const useMarkUnread = () => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    return useCallback(
        (channelID: string, messageID?: string) => {
            call.post("raven.api.raven_channel_member.mark_channel_as_unread", {
                channel_id: channelID,
                ...(messageID ? { message_id: messageID } : {}),
            })
                .then((response: { message?: number | { unread_count: number; last_visit: string } | null }) => {
                    // Null means the server had nothing to anchor on (no member row
                    // on a non-Open channel, or no messages from anyone else) and
                    // no-oped — don't claim success for it.
                    const result = response?.message
                    if (result == null) return
                    toast.success(_("Marked as unread"))
                    // A site on an older Raven returns only the count; its realtime event carries the rest.
                    if (typeof result === "object") {
                        channelUnreadStore.markUnread(channelID, result.last_visit, result.unread_count)
                    }
                })
                .catch((error) => errorResponseToast(_("Could not mark as unread"), error))
        },
        [call],
    )
}
