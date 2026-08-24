import { useContext, useEffect } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { getAllOutbox, purgeExpiredOutbox } from "./outbox"
import { retryOutboxRecord, type PostClient } from "./messageSender"
import { flushVisitOutbox } from "@stores/unread/visitOutbox"

/**
 * A running flush, if any. Module-level (not per-hook) so two triggers can never run
 * two flush loops at the same time — React StrictMode mounts the effect twice in dev,
 * and in production a reconnect can fire while the start-up flush is still going.
 *
 * Two loops at once would defeat the one-at-a-time sending: the second loop hits the
 * inFlight guard on the record the first is sending, skips it, and sends the NEXT one
 * alongside — exactly the parallel send that deadlocks on the channel row. So we chain
 * every flush onto the previous one; they run strictly back to back.
 */
let flushChain: Promise<void> = Promise.resolve()

const runFlush = async (client: PostClient, includeFailed: boolean) => {
    // Read-only site (maintenance / physical restore): every write would be rejected,
    // so retrying would only flip the whole outbox to "failed". Leave the records as
    // they are — the next trigger (reconnect after the site is writable again, or the
    // reload users do anyway after maintenance) re-checks and flushes then.
    if (window.frappe?.boot?.read_only) return

    // Drop week-old sends BEFORE reading — a resurrected stale message is worse than
    // a lost one (see purgeExpiredOutbox).
    await purgeExpiredOutbox()

    const records = await getAllOutbox()
    // Send them one at a time (oldest first), waiting for each before the next.
    // Sending in parallel would make several inserts hit the same channel row at once
    // (deadlock) and let the server timestamp them in any order (messages shuffle).
    for (const record of records) {
        // "rejected" = the server refused it (permission error) — retrying can never
        // succeed, so the auto-flush leaves it alone. Only the user's own Retry
        // (after their access is restored) or Discard moves it.
        if (record.status === "rejected") continue
        if (!includeFailed && record.status !== "sending") continue
        await retryOutboxRecord(client, record)
    }

    // Messages first, then read watermarks — replay any track_visit calls that
    // couldn't be delivered (offline / read-only / error). See visitOutbox.
    await flushVisitOutbox(client)
}

const flushOutbox = (client: PostClient, includeFailed: boolean) => {
    flushChain = flushChain.then(() => runFlush(client, includeFailed)).catch(() => {})
    return flushChain
}

/**
 * Sends the messages saved in the outbox (and replays queued read watermarks —
 * see visitOutbox — after them).
 *
 * - On app start (only if online): re-send messages that were mid-send when the app
 *   last closed ("sending") — we don't know if they reached the server, so we try
 *   again. We leave alone the ones the user already saw fail; those wait for a manual
 *   Retry or for the connection to come back.
 * - When the connection comes back (socket reconnect / browser "online"): re-send
 *   everything still in the outbox, including the failed ones — the connection was the
 *   likely problem, so it's worth another try.
 *
 * Re-sending is safe: the server recognises the client_id and won't create a
 * duplicate, and we skip anything already being sent in this tab.
 */
export const useOutboxAutoRetry = () => {
    const { socket, call } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        const client = call as PostClient

        // If we're offline at app start there's nothing to do yet — coming back
        // online (or the socket reconnecting) will re-send everything.
        if (navigator.onLine) flushOutbox(client, false)

        const onReconnect = () => flushOutbox(client, true)
        window.addEventListener("online", onReconnect)
        socket?.io.on("reconnect", onReconnect)
        return () => {
            window.removeEventListener("online", onReconnect)
            socket?.io.off("reconnect", onReconnect)
        }
    }, [socket, call])
}
