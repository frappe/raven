import { db } from "@db"

/** Minimal Frappe client — `call` from FrappeContext. */
type PostClient = {
    post: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}

/** Resolves to True when the server recorded the visit; False means the site is in
 *  read-only mode RIGHT NOW (the server declines instead of erroring). That response
 *  is the only LIVE read-only signal we get — boot.read_only is a page-load snapshot,
 *  useless when maintenance starts mid-session. */
const postVisit = async (client: PostClient, channelID: string, lastVisit: string) => {
    const res = await client.post<{ message: boolean }>("raven.api.raven_channel_member.track_visit", {
        channel_id: channelID,
        last_visit: lastVisit,
    })
    return res.message !== false
}

/**
 * Sends a read watermark (track_visit) to the server, QUEUEING it durably when it
 * can't be delivered — offline, read-only site, or any server error. Queued
 * watermarks are replayed by flushVisitOutbox on app start / reconnect.
 *
 * Why this exists: last_visit is what the server derives unread counts and the
 * "New messages" divider from. A silently dropped track_visit left it stranded in
 * the past, so already-read messages (often the user's OWN) kept showing as new.
 *
 * Replaying is always safe: the server clamps last_visit (never backward), so an
 * outdated replay is simply a no-op.
 */
export const sendOrQueueVisit = (client: PostClient, channelID: string, lastVisit: string) => {
    // Clearly undeliverable — queue without firing a doomed request. (The boot flag
    // only catches read-only known at page load; a mid-session read-only window is
    // reported live by the response below.)
    if (!navigator.onLine || window.frappe?.boot?.read_only) {
        queueVisit(channelID, lastVisit)
        return
    }
    postVisit(client, channelID, lastVisit)
        .then((recorded) => (recorded ? dropQueuedVisitUpTo(channelID, lastVisit) : queueVisit(channelID, lastVisit)))
        .catch(() => queueVisit(channelID, lastVisit))
}

/** Save a channel's queued watermark — kept only if newer than what's already queued. */
const queueVisit = async (channelID: string, lastVisit: string) => {
    try {
        const existing = await db.visit_outbox.get(channelID)
        // Fixed-width backend datetimes: string compare == chronological compare.
        if (existing && existing.last_visit >= lastVisit) return
        await db.visit_outbox.put({ channel_id: channelID, last_visit: lastVisit, queued_at: Date.now() })
    } catch (error) {
        console.error("visit outbox queue failed", error)
    }
}

/** Remove the queued watermark once a value covering it (>= it) has been delivered.
 *  A NEWER queued value stays — it still needs its own delivery. */
const dropQueuedVisitUpTo = async (channelID: string, delivered: string) => {
    try {
        const existing = await db.visit_outbox.get(channelID)
        if (existing && existing.last_visit <= delivered) await db.visit_outbox.delete(channelID)
    } catch {
        // Leaving a redundant row behind is harmless — the replay is a server-side no-op.
    }
}

/**
 * Replay every queued watermark. Called from the outbox flush (app start, back
 * online, socket reconnect) — after the read-only guard, so a maintenance window
 * never churns the queue. Failures simply stay queued for the next trigger.
 */
export const flushVisitOutbox = async (client: PostClient) => {
    let records
    try {
        records = await db.visit_outbox.toArray()
    } catch (error) {
        console.error("visit outbox read failed", error)
        return
    }
    for (const record of records) {
        try {
            const recorded = await postVisit(client, record.channel_id, record.last_visit)
            // False = the site is STILL read-only — leave it queued for the next trigger.
            if (recorded) await dropQueuedVisitUpTo(record.channel_id, record.last_visit)
        } catch {
            // Still queued; the next reconnect/online/start retries it.
        }
    }
}
