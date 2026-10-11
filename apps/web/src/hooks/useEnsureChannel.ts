import { useEffect, useState, useSyncExternalStore } from "react"
import { useSWRConfig } from "frappe-react-sdk"
import { channelStore } from "@stores/channels/store"

/** The key useChannelListSync fetches under: its reconcile puts a refetched channel in the store. */
const CHANNEL_LIST_KEY = "channel_list"

/**
 * Looks a channel up on the server once before a page calls it missing.
 *
 * The channel list learns about new channels from a socket event, which is lost while the
 * app is in the background: a first DM opened from its notification isn't in the list yet,
 * and the focus refresh is throttled. `failed` means the lookup itself errored, so the
 * channel may still exist; `retry` runs it again.
 */
export const useEnsureChannel = (channelID: string, found: boolean) => {
    const { cache, mutate } = useSWRConfig()
    const loaded = useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)
    // The lookup's outcome for one channel id; another id starts over.
    const [result, setResult] = useState<{ channelID: string; failed: boolean } | null>(null)
    const missing = loaded && !found && Boolean(channelID)
    const settled = result?.channelID === channelID ? result : null

    useEffect(() => {
        if (!missing || settled) return
        let current = true
        mutate(CHANNEL_LIST_KEY).then(
            // A failed revalidation still resolves: SWR keeps the error on the key instead.
            () => current && setResult({ channelID, failed: Boolean(cache.get(CHANNEL_LIST_KEY)?.error) }),
            () => current && setResult({ channelID, failed: true }),
        )
        return () => {
            current = false
        }
    }, [missing, settled, channelID, cache, mutate])

    const retry = () => setResult(null)

    return { checking: missing && !settled, failed: missing && Boolean(settled?.failed), retry }
}
