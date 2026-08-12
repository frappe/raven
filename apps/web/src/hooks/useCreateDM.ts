import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useFrappePostCall, useSWRConfig } from "frappe-react-sdk"
import { useDMChannels } from "@stores/channels/useChannelList"
import _ from "@lib/translate"
import { errorResponseToast } from "@components/ui/error-banner"

/**
 * Open the direct-message channel with a user, creating it only if needed.
 * Shared by every "message this person" affordance — the mention hover card,
 * the command menu, the DM sidebar — so the behaviour is identical everywhere.
 *
 * Fast path: the client already holds every DM channel (`useDMChannels`), so if a
 * DM with this peer exists we just route to it — NO API call. The endpoint is
 * hit only to create a DM that doesn't exist yet.
 *
 * `openDM` resolves with the channel id on success, or `undefined` if creation
 * failed (a toast is shown). Callers chain their own follow-up off that — e.g.
 * the command menu closes itself: `openDM(id).then((ok) => ok && close())`.
 *
 * Pass `{ navigate: false }` to resolve-or-create WITHOUT routing — the forward dialog
 * needs the destination id while staying where it is.
 */
export const useCreateDM = () => {
    const navigate = useNavigate()
    const { mutate } = useSWRConfig()
    const { dmChannels } = useDMChannels()
    const { call, loading } = useFrappePostCall<{ message: string }>(
        "raven.api.raven_channel.create_direct_message_channel",
    )

    const goToDM = useCallback(
        (channelID: string) => navigate(`/dm-channel/${encodeURIComponent(channelID)}`),
        [navigate],
    )

    const openDM = useCallback(
        (userID: string, options?: { navigate?: boolean }): Promise<string | undefined> => {
            // Defaults to navigating — every caller but the forward dialog wants that,
            // and the forward dialog is resolving an id while staying where it is.
            const shouldNavigate = options?.navigate ?? true

            // Fast path: a DM with this peer already exists client-side — just route.
            const existing = dmChannels.find((channel) => channel.peer_user_id === userID)
            if (existing) {
                if (shouldNavigate) goToDM(existing.name)
                return Promise.resolve(existing.name)
            }

            // Otherwise create it, then refresh the list so it appears in the sidebar.
            return call({ user_id: userID })
                .then((res) => {
                    const channelID = res?.message
                    if (!channelID) return undefined
                    mutate("channel_list")
                    if (shouldNavigate) goToDM(channelID)
                    return channelID
                })
                .catch((err) => {
                    errorResponseToast(_("Could not create a DM channel"), err)
                    return undefined
                })
        },
        [call, dmChannels, goToDM, mutate],
    )

    // Kept as `createDM` for callers; resolves existing DMs without an API call.
    return { createDM: openDM, loading }
}
