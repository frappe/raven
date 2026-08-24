import { useContext } from "react"
import { FrappeConfig, FrappeContext, useFrappeEventListener, useSWRConfig } from "frappe-react-sdk"
import { refetchChannelMembersIfLoaded } from "@hooks/useChannelMembers"
import { broadcastChannelListUpdated } from "@stores/channels/channelEvents"

type ChannelEvent = { channel_id: string }

/**
 * Keeps the channel list and per-channel member lists fresh from realtime.
 *
 *  - channel_list_updated: a channel was created / archived / deleted, or the
 *    current user joined or left one. The payload carries only channel_id (not
 *    the channel data), so we revalidate the whole list rather than patch — and
 *    get_all_channels already filters to the user's channels.
 *  - channel_members_updated: a channel's (or thread's — common to both) membership
 *    changed. Refetch that id's member list in the channelMembersStore, but ONLY if it's
 *    already loaded — we never build member lists for threads the user hasn't opened.
 *
 * The channel list cache (SWR) and the member store are shared app-wide, so this is
 * mounted once at the shell.
 */
export const useChannelListRealtime = () => {
    const { mutate } = useSWRConfig()
    const { call } = useContext(FrappeContext) as FrappeConfig

    // TODO: Add debouncing

    useFrappeEventListener("channel_list_updated", (event: ChannelEvent) => {
        mutate("channel_list")
        // Rebroadcast (after-commit) for in-app subscribers — e.g. the Pins tab
        // refetches this channel's pins. See channelEvents for the one-socket-
        // subscriber-per-event rule.
        if (event?.channel_id) broadcastChannelListUpdated(event.channel_id)
    })

    useFrappeEventListener("channel_members_updated", (event: ChannelEvent) => {
        if (!event?.channel_id) return
        refetchChannelMembersIfLoaded(call, event.channel_id)
    })
}
