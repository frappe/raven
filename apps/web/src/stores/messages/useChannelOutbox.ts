import { useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@db"
import { injectOutboxRecord } from "./messageSender"

/**
 * Keeps a channel's not-yet-confirmed sends on screen. It watches the channel's saved
 * outbox (live — it re-runs whenever the outbox changes) and puts any pending or
 * failed messages back on screen. So a message you sent shows up again after a
 * refresh, survives the channel being dropped from memory, and appears across browser
 * tabs. It only ever adds messages — removing them happens when a send is confirmed or
 * discarded. Adding one that's already on screen does nothing.
 *
 * Mounted by ChatStream, so it runs once for each open channel.
 */
export const useChannelOutbox = (channelID: string) => {
    const records = useLiveQuery(
        () => db.outbox.where("channel_id").equals(channelID).toArray(),
        [channelID],
    )

    useEffect(() => {
        if (!records) return
        for (const record of records) injectOutboxRecord(record)
    }, [records])
}
