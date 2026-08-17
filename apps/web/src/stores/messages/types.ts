import type { Message } from "@raven/types/common/Message"
import type { LinkPreviewData } from "@stores/linkPreviews/store"

/** Status of a message optimistically inserted on send, before the server ack lands. */
export type MessageStatus = "sending" | "failed"

/** A locally-created message shown immediately on send; carries `_status` until reconciled. */
export type OptimisticMessage = Message & { _status: MessageStatus }

/** Narrows to an optimistic (not-yet-server-confirmed) message. */
export const isOptimistic = (message: Message): message is OptimisticMessage =>
    (message as OptimisticMessage)._status !== undefined

/**
 * One channel's message window.
 *
 * The store holds a bounded, contiguous window of a channel's history.
 * `order` is ascending by (creation, name) — index 0 is the oldest loaded message.
 * When `hasNewerMessages` is true the window is detached from the live edge
 * (e.g. after jumping to an old message) and incoming messages are NOT inserted.
 */
export type ChannelMessagesState = {
    status: "idle" | "loading" | "ready" | "error"
    error: string | null
    /** id → message. Message references are stable unless that message changed. */
    byId: ReadonlyMap<string, Message>
    /** Message ids sorted ascending by (creation, name). */
    order: readonly string[]
    hasOlderMessages: boolean
    hasNewerMessages: boolean
    loadingOlder: boolean
    loadingNewer: boolean
    /**
     * The first unread message at channel entry (server's `first_unread_message`), or null if
     * caught up. FROZEN — set only on the initial load, never by new/sent messages — so the
     * "New messages" divider sits where you left off and a message you send doesn't spawn a line.
     */
    firstUnreadMessage: string | null
}

/** Response shape shared by get_messages / get_older_messages / get_newer_messages. */
export type MessagesPage = {
    messages: Message[]
    has_old_messages?: boolean
    has_new_messages?: boolean
    /** The member's server-side read watermark at load — baselines client last_visit tracking. */
    last_visit?: string | null
    /** First unread message id when the load was anchored to unread (drives the "New messages" divider). */
    first_unread_message?: string | null
    /** Previews for this window's links, keyed by RAW url (the Phase 5
     *  side-car). Seeds linkPreviewStore before the rows render, so cards
     *  paint together with their messages. Lives on the response only —
     *  never persist it with message windows. */
    previews?: Record<string, LinkPreviewData | null>
}

/** A date divider between messages from different days. */
export type DateBlock = {
    message_type: "date"
    /** Raw date key (YYYY-MM-DD) — also the formatted label consumers display. */
    creation: string
    name: string
}

/**
 * Consecutive messages sent as one batch (shared `message_batch_id`) — e.g.
 * multiple files — rendered as a single visual block (album/file group).
 */
export type MessageBatchBlock = {
    message_type: "batch"
    /** `batch-` + the shared batch id. */
    name: string
    /** Creation of the first (oldest) member. */
    creation: string
    /** Members in ascending order; each is still individually addressable. */
    messages: Message[]
    is_continuation: 0 | 1
}

/**
 * The "New messages" divider — inserted once, before the first message created after the
 * member's last_visit (the read watermark captured at channel entry). Stays put as the user
 * reads; recomputed only on re-entry.
 */
export type UnreadBlock = {
    message_type: "unread"
    name: "unread-divider"
}

/** What the chat stream renders: messages (decorated with continuation/pinned flags), batches, date dividers, and the unread divider. */
export type StreamBlock = Message | DateBlock | MessageBatchBlock | UnreadBlock

export const MAX_WINDOW_SIZE = 300

export const initialChannelState: ChannelMessagesState = {
    status: "idle",
    error: null,
    byId: new Map(),
    order: [],
    hasOlderMessages: false,
    hasNewerMessages: false,
    loadingOlder: false,
    loadingNewer: false,
    firstUnreadMessage: null,
}
