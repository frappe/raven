import { RavenUser } from "@raven/types/Raven/RavenUser"
import { Dexie, type EntityTable } from "dexie"

export type UserData = Pick<RavenUser, 'name' | 'full_name' | 'user_image' | 'first_name' | 'enabled' | 'type' | 'availability_status' | 'custom_status' | 'contact_number'>

/** An already-uploaded attachment going out with a send (its stable URL + size). */
export interface OutboxFile {
    file_url: string
    file_size: number
}

/**
 * A send that hasn't been acknowledged yet — the durable outbox.
 *
 * Persisted so pending/failed sends survive a refresh (and can auto-retry on
 * reconnect). Keyed by `client_id`, which is also the message_batch_id, so the
 * server can dedupe a retried send and the client can match the realtime echo.
 */
export interface OutboxMessage {
    /** Primary key — the client-generated batch id (= message_batch_id). */
    client_id: string
    channel_id: string
    owner: string
    /** Message HTML (empty when the send is files-only). */
    content: string
    files: OutboxFile[]
    /** Backend-shaped creation timestamp of the optimistic placeholders (live-edge sort). */
    creation: string
    /** sending = in flight / in doubt; failed = the last attempt errored (auto-retried
     *  on reconnect); rejected = the server refused it (permission error) — auto-retry
     *  can never succeed, so only a manual Retry or Discard moves it. */
    status: 'sending' | 'failed' | 'rejected'
    /** When the send was first queued (ms) — orders the outbox for retry. */
    queued_at: number
    /** Reply: id of the message being replied to (sent as linked_message). */
    linked_message?: string
    /** Reply: JSON snapshot of the replied message, so the reply preview renders on rehydrate. */
    replied_message_details?: string
    /** Send without notifying recipients — persisted so a retried send stays silent. */
    send_silently?: boolean
}

/**
 * A read-position update (track_visit) the server hasn't confirmed — queued when the
 * post can't be delivered (offline, read-only site, server error) and replayed on
 * reconnect. Only the NEWEST watermark per channel matters, so one row per channel.
 * Replaying is always safe: the server clamps last_visit (never backward), so an
 * outdated replay is a no-op.
 */
export interface OutboxVisit {
    /** Primary key — the channel (or thread) the visit belongs to. */
    channel_id: string
    /** Read watermark — creation timestamp of the newest message the user has seen. */
    last_visit: string
    /** When it was queued (ms). */
    queued_at: number
}

const db = new Dexie("RavenDB") as Dexie & {
    users: EntityTable<
        UserData,
        "name" // primary key "name"
    >
    outbox: EntityTable<
        OutboxMessage,
        "client_id" // primary key "client_id"
    >
    visit_outbox: EntityTable<
        OutboxVisit,
        "channel_id" // primary key "channel_id"
    >
}

// Schema declaration:
db.version(1).stores({
    users: "name, enabled"
})

// v2: durable outbox for un-acked sends (Layer 4). Indexed by channel for
// per-channel rehydration, and by queued_at for stable retry ordering.
db.version(2).stores({
    outbox: "client_id, channel_id, queued_at"
})

// v3: durable queue for un-acked read watermarks (track_visit) — replayed on
// reconnect, so a failed flush can't strand the server's last_visit in the past
// (which showed phantom "New messages" dividers/badges for already-read messages).
db.version(3).stores({
    visit_outbox: "channel_id"
})

export { db }