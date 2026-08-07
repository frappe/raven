import { useCallback, useContext } from "react"
import { FrappeConfig, FrappeContext, useSWRConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import { errorResponseToast } from "@components/ui/error-banner"
import _ from "@lib/translate"

/**
 * Mark a channel unread — from a specific message (the anchor and everything
 * after become unread) or, with no messageID, from the channel's latest message.
 *
 * The store update rides the realtime `mark_unread` event the backend publishes
 * to all of this user's sessions (exact watermark + server-computed count —
 * useUnreadRealtime routes it to channelUnreadStore.markUnread, which also rolls
 * the read tracker's baseline back so re-entering the channel re-reads it). On
 * the POST response we additionally revalidate the authoritative counts as a
 * socket-down fallback, instead of re-deriving watermarks client-side.
 *
 * The success toast is the only immediate feedback on mobile, where the sidebar
 * badge isn't visible from inside a channel.
 */
export const useMarkUnread = () => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { mutate } = useSWRConfig()

    return useCallback(
        (channelID: string, messageID?: string) => {
            call.post("raven.api.raven_channel_member.mark_channel_as_unread", {
                channel_id: channelID,
                ...(messageID ? { message_id: messageID } : {}),
            })
                .then((response: { message?: number | null }) => {
                    // A null count means the server had nothing to anchor on (no
                    // member row on a non-Open channel, or no messages from anyone
                    // else) and no-oped — don't claim success for it.
                    if (response?.message == null) return
                    toast.success(_("Marked as unread"))
                    mutate("unread_channel_counts")
                })
                .catch((error) => errorResponseToast(_("Could not mark as unread"), error))
        },
        [call, mutate],
    )
}
