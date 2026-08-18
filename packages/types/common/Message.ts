export type Message = FileMessage | TextMessage | ImageMessage | PollMessage | SystemMessage

export interface BaseMessage {
    name: string,
    owner: string,
    _liked_by: string,
    channel_id: string,
    creation: string,
    modified: string,
    message_type: 'Text' | 'File' | 'Image' | 'Poll' | 'System',
    message_reactions?: string | null,
    is_continuation: 1 | 0
    /** Stable React key for the stream row (stream selector decoration). A
     *  v3 send keeps ONE key across the optimistic→ack swap (batch-id based),
     *  so the row — and its media DOM — survives instead of remounting. */
    render_key?: string
    is_reply: 1 | 0
    linked_message?: string | null
    link_doctype?: string
    link_document?: string
    is_edited: 1 | 0
    is_forwarded: 1 | 0
    /** JSON as string */
    replied_message_details?: string,
    poll_id?: string
    is_bot_message?: 1 | 0,
    bot?: string,
    hide_link_preview?: 1 | 0,
    is_thread: 1 | 0,
    /** Formatted timestamp - being used on the mobile app */
    formattedTime?: string,
    is_pinned: 1 | 0,
    might_contain_link_preview?: boolean,
    content?: string,
    isOpenInThread?: boolean,
    /** Optional JSON payload (e.g. converted_to_channel_*, forwarded_thread). Backend shape TBD. */
    json?: string | Record<string, unknown>,
    /** Shared id stamped on messages sent together as one batch (e.g. multiple files). Consecutive messages with the same id render as one block. */
    message_batch_id?: string | null,
    /** Newline separated list of links in the message */
    links?: string
}

export interface FileMessage extends BaseMessage {
    text: string,
    file: string,
    message_type: 'File'
    /** Size of the attached file in bytes (denormalized onto the message at send). */
    file_size?: number,
}

export interface ImageMessage extends BaseMessage {
    text: string,
    file: string,
    message_type: 'Image'
    /** Size of the attached image in bytes (denormalized onto the message at send). */
    file_size?: number,
    thumbnail_width?: number,
    thumbnail_height?: number,
    image_thumbnail?: string,
    blurhash?: string
}

export interface TextMessage extends BaseMessage {
    text: string,
    message_type: 'Text',
    content?: string
}

export interface PollMessage extends BaseMessage {
    text: string,
    message_type: 'Poll',
    poll_id: string,
    content?: string
}

export interface SystemMessage extends BaseMessage {
    message_type: 'System',
    text: string,
}

export type DateBlock = {
    block_type: 'date',
    data: string
}

export type MessageBlock = {
    block_type: 'message',
    data: Message
}

export type MessagesWithDate = (DateBlock | MessageBlock)[]