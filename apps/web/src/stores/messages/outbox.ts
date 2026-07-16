import { db, type OutboxMessage } from "@db"

/**
 * Saves/loads the outbox in the browser database (Dexie/IndexedDB). The outbox is the
 * list of sends the server hasn't confirmed yet — kept on disk so they survive a page
 * refresh and can be re-sent. The on-screen message list is what's actually shown;
 * this is just the saved copy. Saving is best-effort: if a write fails we only log it
 * (a storage hiccup must never break sending), so callers don't wait on these.
 */

/**
 * The ids of sends we're in the middle of deleting from the outbox. Deleting runs in
 * the background, so there's a brief gap between a send being confirmed and its record
 * actually leaving storage. During that gap the live outbox query could still see the
 * old record and try to put the message back on screen (or retry it). This list lets
 * those steps skip a record that's on its way out.
 */
const settling = new Set<string>()

/** True while a record is being deleted — don't put it back on screen or retry it. */
export const isSettling = (clientID: string) => settling.has(clientID)

/** Save (or overwrite) one outbox record. Called when a message is first sent. */
export const putOutbox = (record: OutboxMessage) =>
    db.outbox.put(record).catch((error) => console.error("outbox put failed", error))

/** Remove a record once the server confirms its send (or the user discards it). */
export const removeOutbox = (clientID: string) => {
    settling.add(clientID)
    return db.outbox
        .delete(clientID)
        .catch((error) => console.error("outbox delete failed", error))
        .finally(() => settling.delete(clientID))
}

/** Change a record's status ("sending" / "failed" / "rejected") as its send plays out. */
export const setOutboxStatus = (clientID: string, status: OutboxMessage["status"]) =>
    db.outbox.update(clientID, { status }).catch((error) => console.error("outbox update failed", error))

/** How long an unconfirmed send stays retryable/visible: 7 days. Long enough that a
 *  send queued offline over a weekend still goes out; short enough that a resurrected
 *  week-old message doesn't read as a glitch to the recipient. */
const OUTBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Drop records older than the TTL — called at the start of every auto-retry flush,
 * BEFORE anything is injected or re-sent. Auto-sending a week-late message into a
 * conversation that moved on is worse than losing it, and failed sends the user
 * hasn't dealt with in a week are abandoned. A cheap range delete (queued_at is
 * indexed); Dexie live queries (useChannelOutbox) see the deletion, so no stale
 * bubbles are left on screen.
 */
export const purgeExpiredOutbox = () =>
    db.outbox
        .where("queued_at")
        .below(Date.now() - OUTBOX_TTL_MS)
        .delete()
        .then((count) => {
            if (count > 0) console.info(`outbox: dropped ${count} expired send(s) older than 7 days`)
        })
        .catch((error) => console.error("outbox purge failed", error))

/** Every saved send, oldest first — used to restore them on app start and retry in order. */
export const getAllOutbox = (): Promise<OutboxMessage[]> =>
    db.outbox.orderBy("queued_at").toArray().catch((error) => {
        console.error("outbox read failed", error)
        return []
    })
