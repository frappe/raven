import { Message, BaseMessage } from "@raven/types/common/Message"
import { SearchResult } from "@hooks/useSqliteSearch"

/**
 * Map a sqlite-search row to a Message so MessageContent + MessageResultBlock
 * can render it uniformly.
 *
 */
export function searchResultToMessage(r: SearchResult): Message {
    const messageType = (r.message_type as BaseMessage['message_type']) ?? 'Text'

    const base: BaseMessage = {
        name: r.id,
        owner: r.author,
        _liked_by: "[]",
        channel_id: r.channel_id,
        creation: r.creation,
        modified: r.creation,
        message_type: messageType,
        is_continuation: 0,
        is_reply: 0,
        is_edited: 0,
        is_forwarded: 0,
        is_thread: r.is_thread ?? 0,
        is_pinned: 0,
        content: r.content,
    }

    if (messageType === 'File') {
        return {
            ...base,
            message_type: 'File',
            text: r.content,
            file: r.internal_link ?? '',
        }
    }
    if (messageType === 'Image') {
        return {
            ...base,
            message_type: 'Image',
            text: r.content,
            file: r.internal_link ?? '',
        }
    }
    if (messageType === 'Poll') {
        return {
            ...base,
            message_type: 'Poll',
            text: r.content,
            poll_id: r.poll_id ?? '',
            content: r.content,
        }
    }
    if (messageType === 'System') {
        return {
            ...base,
            message_type: 'System',
            text: r.content,
        }
    }
    return {
        ...base,
        message_type: 'Text',
        text: r.content,
        content: r.content,
    }
}
