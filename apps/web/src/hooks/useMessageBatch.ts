import { useFrappeGetCall } from "frappe-react-sdk"
import type { SWRConfiguration } from "swr"
import type { Message } from "@raven/types/common/Message"

/**
 * Fetch a message TOGETHER with its send batch, in one call.
 *
 * get_message_batch returns every message that was sent together with this
 * one (same message_batch_id), oldest first — and a list of ONE for a normal
 * unbatched message. So this is the only fetch a message ever needs: no
 * get_doc first, no second call for the batch.
 *
 * `anchor` is the requested message itself, for callers that only need that
 * one (routing on its channel_id, a teaser card). `messages` is the whole
 * batch, for callers that render it.
 *
 * Pass null/empty to skip the fetch. Callers that share a message share the
 * SWR key (message_batch:<id>), so e.g. the thread route and the thread
 * header dedupe into one request — same pattern the old get_doc key had.
 */
export const useMessageBatch = (messageID?: string | null, options?: SWRConfiguration) => {
    const { data, error, isLoading } = useFrappeGetCall<{ message: Message[] }>(
        "raven.api.raven_message.get_message_batch",
        { message_id: messageID },
        messageID ? `message_batch:${messageID}` : null,
        options,
    )
    const messages = data?.message
    const anchor = messages?.find((message) => message.name === messageID) ?? messages?.[0]
    return { messages, anchor, error, isLoading }
}
