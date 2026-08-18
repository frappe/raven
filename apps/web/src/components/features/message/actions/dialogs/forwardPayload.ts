import type { Message } from "@raven/types/common/Message"

/**
 * The Raven Message fields that survive a forward.
 *
 * A whitelist rather than a spread of the store's message object, for three reasons:
 * the store object carries fields that are not doctype fields at all (`_status`,
 * `is_pinned` — derived from the channel's pinned string — `formattedTime`,
 * `isOpenInThread`); the real thumbnail fieldname is `file_thumbnail` while the TS
 * type declares `image_thumbnail`, so copying by TS shape loses it; and several real
 * fields must NOT travel (see below).
 *
 * Every entry here is a field `chat_stream.py` actually sends to the client, so every
 * one is in hand at forward time. The doctype's image_width/image_height are selected
 * nowhere and so are absent, not omitted on purpose.
 *
 * Deliberately excluded:
 * - `message_batch_id` — the destination groups consecutive messages sharing this id
 *   into one album, so carrying it makes the copy fuse with an unrelated batch.
 * - `poll_id` — a copy would point at the SAME poll doc, so a vote in one place would
 *   move the other. (Forward is hidden for polls; this is the second lock.)
 * - `message_reactions`, `linked_message` — belong to the source conversation. The
 *   backend nulls both; excluded here so the payload says so itself.
 * - `is_bot_message` / `bot` — the copy is sent by you, not by the bot that wrote it.
 *
 * `is_reply` and `replied_message_details` DO travel: they're the input to the
 * backend's `build_reply_blockquote`, which inlines the quote before the copy is made
 * (the reply's `linked_message` points into the source channel and can't come along).
 * The backend zeroes `is_reply` on the copy after using them.
 */
const FORWARDED_FIELDS = [
    "text",
    "json",
    "file",
    "file_thumbnail",
    "file_size",
    "message_type",
    "content",
    "link_doctype",
    "link_document",
    "thumbnail_width",
    "thumbnail_height",
    "blurhash",
    "links",
    "hide_link_preview",
    "is_reply",
    "replied_message_details",
] as const

/**
 * The `forwarded_message` dict for `raven.api.raven_message.forward_message`.
 * Absent fields are omitted rather than sent as null, so `frappe.get_doc` sees a
 * clean dict and unset Attach/Data fields keep their doctype defaults.
 */
export const buildForwardPayload = (message: Message): Record<string, unknown> => {
    // Read by fieldname, not by TS shape — see file_thumbnail above.
    const source = message as unknown as Record<string, unknown>
    const payload: Record<string, unknown> = {}
    for (const field of FORWARDED_FIELDS) {
        const value = source[field]
        if (value !== undefined && value !== null) payload[field] = value
    }
    // For a reply, the backend's build_reply_blockquote inlines the quoted message
    // into `text` only — `json` is left as the original, unquoted body. Carrying both
    // would give the copy two sources of truth that disagree; v3 renders `text` today
    // so this is inert, but drop `json` so a future JSON-based renderer can't silently
    // lose the quote.
    if (message.is_reply === 1) {
        delete payload.json
    }
    return payload
}
