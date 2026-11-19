import type { BaseMessage, Message } from '@raven/types/common/Message'
import { pollPreviewHtml } from '@components/common/MessageResultBlock/pollPreviewHtml'

export type SavedMessageRow = {
    name: string
    owner: string
    creation: string
    is_thread: 0 | 1
    text?: string
    /** Plain text. For a poll this is the question and its options, one per line. */
    content?: string
    channel_id: string
    file?: string
    /** Voice notes only: `{ duration, waveform }`. Locations: `{ latitude, longitude }`. */
    json?: string | Record<string, unknown>
    message_type?: BaseMessage['message_type']
    message_reactions?: string
    _liked_by?: string
    workspace?: string
    thumbnail_width?: number
    thumbnail_height?: number
    is_bot_message?: 0 | 1
    bot?: string
    /** Real channel the message (or its thread root) belongs to. */
    parent_channel_id?: string
}

/** Map a saved-message API row to a Message for uniform rendering. */
export function savedRowToMessage(r: SavedMessageRow): Message {
    const messageType = r.message_type ?? 'Text'

    const base: BaseMessage = {
        name: r.name,
        owner: r.owner,
        _liked_by: r._liked_by ?? '[]',
        channel_id: r.channel_id,
        creation: r.creation,
        modified: r.creation,
        message_type: messageType,
        is_continuation: 0,
        is_reply: 0,
        is_edited: 0,
        is_forwarded: 0,
        is_thread: 0,
        is_pinned: 0,
    }

    if (messageType === 'Voice') {
        return { ...base, message_type: 'Voice', text: '', file: r.file ?? '', json: r.json }
    }
    // The snapshot is optional; its absence must not read as an empty attachment.
    if (messageType === 'Location') {
        return { ...base, message_type: 'Location', text: r.text ?? '', ...(r.file ? { file: r.file } : {}), json: r.json }
    }
    if (messageType === 'File' || messageType === 'Image') {
        return { ...base, message_type: messageType, text: r.text ?? '', file: r.file ?? '' }
    }
    // A poll renders as a static question + options block (see pollPreviewHtml).
    if (messageType === 'Poll') {
        // poll_id is required by the type but unused here: the block never fetches the live poll.
        return { ...base, message_type: 'Poll', text: pollPreviewHtml(r.content), poll_id: '' }
    }
    return { ...base, message_type: 'Text', text: r.text ?? '' }
}
