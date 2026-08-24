import { useFrappeEventListener, useSWRConfig } from "frappe-react-sdk"

/**
 * Keeps the polls in ONE stream live. The backend publishes `poll_update` (a vote /
 * retraction / close) to the CHANNEL doc room — which we're already subscribed to for
 * messages — so this rides that subscription, not a per-poll document subscription
 * (v2's unscalable approach).
 *
 * Scoped to the stream's channel, NOT global: only the channel/thread the user is actually
 * viewing has a mounted ChatStream, so we ignore updates for warm background channels —
 * their polls aren't on screen and revalidate on their own when reopened (the poll remounts).
 * That also keeps us from refetching every poll SWR ever cached. Called by ChatStream, so
 * there's one listener per displayed stream (the channel + an open thread drawer), not one
 * per poll.
 */
export const usePollRealtime = (channelID: string) => {
    const { mutate } = useSWRConfig()
    useFrappeEventListener("poll_update", (event: { message_id?: string; channel_id?: string }) => {
        if (event?.channel_id === channelID && event.message_id) mutate(["poll", event.message_id])
    })
}
