import dayjs from "dayjs"
import type { FrappeError } from "frappe-react-sdk"
import type { Message } from "@raven/types/common/Message"
import type { OutboxMessage } from "@db"
import { getAttachmentKind } from "@utils/attachmentPreview"
import _ from "@lib/translate"
import { channelMessagesStore } from "./store"
import { channelUnreadStore } from "@stores/unread/store"
import { putOutbox, removeOutbox, setOutboxStatus, isSettling } from "./outbox"
import type { OptimisticMessage } from "./types"
import { errorResponseToast } from "@components/ui/error-banner"

/** Minimal Frappe client — `call` from FrappeContext. */
export type PostClient = {
    post: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}

/** An already-uploaded attachment going out with a send: its stable URL + size. */
export type OutgoingFile = {
    file_url: string
    file_size: number
}

/** Backend datetime shape (6-digit microseconds) so the placeholder sorts at the live edge. */
const optimisticNow = () => dayjs().format("YYYY-MM-DD HH:mm:ss.SSS") + "000"

/**
 * Builds the messages we show on screen the instant the user hits send — before the
 * server confirms them — attachments first, then the text. They all share `batchId`
 * (the client_id) and are marked "sending". `creation` (the timestamp) is passed in
 * when we rebuild a saved send after a refresh, so it looks exactly as it did before.
 */
export const buildOptimisticMessages = (
    channelID: string,
    batchId: string,
    owner: string,
    content: string,
    files: OutgoingFile[],
    creation: string = optimisticNow(),
    reply?: { linkedMessage: string; repliedMessageDetails?: string },
): OptimisticMessage[] => {
    const base = (extra: Partial<Message>): OptimisticMessage =>
        ({
            owner,
            creation,
            channel_id: channelID,
            message_batch_id: batchId,
            _status: "sending",
            ...extra,
        }) as unknown as OptimisticMessage

    const messages = files.map((file, i) =>
        base({
            name: `${batchId}-${i}`,
            message_type: getAttachmentKind(file.file_url) === "image" ? "Image" : "File",
            file: file.file_url,
            file_size: file.file_size,
        }),
    )
    if (content) {
        messages.push(base({ name: `${batchId}-text`, message_type: "Text", text: content }))
    }

    // Mirror the backend: the reply attaches to the LAST message of the batch (the
    // caption when there's text, else the final attachment), so the preview renders
    // on the same message the server will return.
    if (reply && messages.length > 0) {
        Object.assign(messages[messages.length - 1], {
            is_reply: 1,
            linked_message: reply.linkedMessage,
            ...(reply.repliedMessageDetails ? { replied_message_details: reply.repliedMessageDetails } : {}),
        })
    }
    return messages
}

/**
 * Send a new message: show it on screen right away, save it to the outbox (the saved
 * list of not-yet-confirmed sends — like an email outbox — so it isn't lost on a
 * refresh and can be retried), then send it to the server. Saving to the outbox runs
 * in the background and never delays the send.
 */
export const enqueueSend = (
    client: PostClient,
    params: {
        channelID: string
        batchId: string
        owner: string
        content: string
        files: OutgoingFile[]
        /** Set when this send is a reply: the message being replied to + a snapshot for the preview. */
        linkedMessage?: string
        repliedMessageDetails?: string
    },
) => {
    const { channelID, batchId, owner, content, files, linkedMessage, repliedMessageDetails } = params
    const creation = optimisticNow()
    const reply = linkedMessage ? { linkedMessage, repliedMessageDetails } : undefined

    const placeholders = buildOptimisticMessages(channelID, batchId, owner, content, files, creation, reply)
    channelMessagesStore.addOptimisticMessages(channelID, batchId, placeholders)

    // Sending means you're caught up — clear the unread badge instantly (the read tracker
    // still posts track_visit to the server when the message scrolls into view).
    channelUnreadStore.markRead(channelID, creation, true)

    putOutbox({
        client_id: batchId,
        channel_id: channelID,
        owner,
        content,
        files,
        creation,
        status: "sending",
        queued_at: Date.now(),
        linked_message: linkedMessage,
        replied_message_details: repliedMessageDetails,
    })

    submitSend(client, channelID, batchId, content, files, linkedMessage)
}

/**
 * The ids of sends whose request to the server is currently running (waiting for a
 * response). Auto-retry checks this so it never sends the same message twice — for
 * example if "back online" and "socket reconnected" both happen at once.
 *
 * This is a different list from the store's `pendingSends`. `pendingSends` is about
 * the server broadcasting our own message back to us (it broadcasts to everyone in
 * the channel) — we ignore that copy so the message doesn't show twice. A message we
 * queued while offline is NOT being sent right now (so it's not in this list), but we
 * still want to ignore its broadcast later — so the two lists aren't the same.
 */
const inFlight = new Set<string>()

/**
 * Send the request to the server and handle the response:
 *  - Success: swap the on-screen message for the real one from the server, and remove
 *    it from the outbox.
 *  - Offline: leave it as-is (still showing "sending"), with no error — auto-retry
 *    will send it once the connection is back.
 *  - Any other failure: mark it failed (shows Retry / Discard) and show an error.
 * Reuses `batchId` (= client_id) so a retry counts as the same message — the server
 * recognises it and won't create a duplicate.
 *
 * `silent` skips the failure toast: the automatic outbox flush passes it because a
 * flush can fail many messages at once (server down, read-only window) and the user
 * didn't just act — the failed bubbles (Retry / Discard) are the right signal there.
 * Interactive sends (send button, manual Retry) keep the toast.
 */
export const submitSend = (
    client: PostClient,
    channelID: string,
    batchId: string,
    content: string,
    files: OutgoingFile[],
    linkedMessage?: string,
    opts?: { silent?: boolean },
) => {
    inFlight.add(batchId)
    return client
        .post<{ message: Message[] }>("raven.api.raven_message.send_message_with_attachments", {
            channel_id: channelID,
            content,
            files,
            client_id: batchId,
            // Reply: the backend attaches these to the last message of the batch.
            is_reply: linkedMessage ? 1 : 0,
            linked_message: linkedMessage ?? null,
        })
        .then((res) => {
            channelMessagesStore.resolveOptimisticSend(channelID, batchId, res.message ?? [])
            removeOutbox(batchId)
        })
        .catch((error: FrappeError) => {
            // Offline: don't show an error — the message stays on screen as "sending"
            // and useOutboxAutoRetry will send it again once the connection is back.
            if (!navigator.onLine) return

            channelMessagesStore.failOptimisticSend(channelID, batchId)
            // A permission error is PERMANENT (removed from the channel, lost create
            // rights): no amount of retrying fixes it, so mark the record "rejected" —
            // the auto-flush skips those. Manual Retry still works (access may have
            // been restored) and re-runs this same classification.
            const isPermissionError = error?.exc_type === "PermissionError" || error?.httpStatus === 403
            setOutboxStatus(batchId, isPermissionError ? "rejected" : "failed")
            if (opts?.silent) return
            // One shared id means many failures at once show a single error, not a
            // pile of them. (The failed message on screen is the main signal; this
            // error also covers sends the user has scrolled past.)
            errorResponseToast(_("Could not send your message"), error)
        })
        .finally(() => inFlight.delete(batchId))
}

/** Re-send a failed message when the user clicks Retry — rebuild what to send from the
 *  message still shown on screen. */
export const retrySend = (client: PostClient, channelID: string, batchId: string) => {
    const placeholders = channelMessagesStore.getOptimisticMessages(channelID, batchId)
    if (placeholders.length === 0) return
    const content = placeholders.find((m) => m.message_type === "Text")?.text ?? ""
    const files = placeholders
        .filter((m) => (m as { file?: string }).file)
        .map((m) => ({
            file_url: (m as { file?: string }).file as string,
            file_size: (m as { file_size?: number }).file_size ?? 0,
        }))
    // The reply lives on whichever placeholder carries linked_message (the last one).
    const linkedMessage = placeholders
        .map((m) => (m as { linked_message?: string }).linked_message)
        .find(Boolean)

    channelMessagesStore.retryOptimisticSend(channelID, batchId)
    setOutboxStatus(batchId, "sending")
    submitSend(client, channelID, batchId, content, files, linkedMessage)
}

/** Discard a failed send: remove it both from the screen and from the saved outbox. */
export const discardSend = (channelID: string, batchId: string) => {
    channelMessagesStore.discardOptimisticSend(channelID, batchId)
    removeOutbox(batchId)
}

/**
 * Put a saved send back on screen *without* sending it again. Used to make a pending
 * or failed message show up again after a refresh, or after the channel was dropped
 * from memory and reopened. Does nothing if the message is already on screen.
 */
export const injectOutboxRecord = (record: OutboxMessage) => {
    if (isSettling(record.client_id)) return
    if (channelMessagesStore.getOptimisticMessages(record.channel_id, record.client_id).length > 0) return
    const placeholders = buildOptimisticMessages(
        record.channel_id,
        record.client_id,
        record.owner,
        record.content,
        record.files,
        record.creation,
        record.linked_message ? { linkedMessage: record.linked_message, repliedMessageDetails: record.replied_message_details } : undefined,
    )
    channelMessagesStore.addOptimisticMessages(record.channel_id, record.client_id, placeholders)
    // failed AND rejected both render as a failed bubble (Retry / Discard).
    if (record.status !== "sending") channelMessagesStore.failOptimisticSend(record.channel_id, record.client_id)
}

/**
 * Re-send a saved message (the automatic retry on app start / reconnect). Works even
 * for a channel that isn't open: it puts the message on screen if needed, then sends.
 * Skips any message whose request to the server is already running in this tab.
 */
export const retryOutboxRecord = (client: PostClient, record: OutboxMessage): Promise<unknown> => {
    if (isSettling(record.client_id)) return Promise.resolve()
    if (inFlight.has(record.client_id)) return Promise.resolve()

    if (channelMessagesStore.getOptimisticMessages(record.channel_id, record.client_id).length === 0) {
        const placeholders = buildOptimisticMessages(
            record.channel_id,
            record.client_id,
            record.owner,
            record.content,
            record.files,
            record.creation,
            record.linked_message ? { linkedMessage: record.linked_message, repliedMessageDetails: record.replied_message_details } : undefined,
        )
        channelMessagesStore.addOptimisticMessages(record.channel_id, record.client_id, placeholders)
    } else {
        channelMessagesStore.retryOptimisticSend(record.channel_id, record.client_id)
    }

    setOutboxStatus(record.client_id, "sending")
    // silent: an automatic flush shouldn't toast — see submitSend.
    return submitSend(client, record.channel_id, record.client_id, record.content, record.files, record.linked_message, { silent: true })
}
