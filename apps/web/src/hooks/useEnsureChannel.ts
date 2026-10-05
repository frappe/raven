import { useEffect, useState, useSyncExternalStore } from "react"
import { useSWRConfig } from "frappe-react-sdk"
import { channelStore } from "@stores/channels/store"

/**
 * Looks a channel up on the server once before a page calls it missing.
 *
 * The channel list learns about new channels from a socket event, which is lost while the
 * app is in the background: a first DM opened from its notification isn't in the list yet,
 * and the focus refresh is throttled. True while that one refetch is still running.
 */
export const useEnsureChannel = (channelID: string, found: boolean) => {
    const { mutate } = useSWRConfig()
    const loaded = useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)
    const [checked, setChecked] = useState<string | null>(null)
    const missing = loaded && !found && Boolean(channelID)

    useEffect(() => {
        if (!missing || checked === channelID) return
        let current = true
        // The same key useChannelListSync fetches under: its reconcile puts the channel in the store.
        mutate("channel_list").finally(() => {
            if (current) setChecked(channelID)
        })
        return () => {
            current = false
        }
    }, [missing, channelID, checked, mutate])

    return missing && checked !== channelID
}
