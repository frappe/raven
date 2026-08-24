export type ThreadMessage = {
    bot: string,
    channel_id: string,
    content: string,
    creation: string,
    file: string,
    hide_link_preview: 0 | 1,
    image_height: string,
    image_width: string,
    is_ai_thread: 0 | 1,
    is_bot_message: 0 | 1,
    is_dm_thread: 0 | 1,
    last_message_timestamp: string,
    link_doctype: string,
    link_document: string,
    message_type: "Text" | "Image" | "File" | "Poll",
    name: string,
    owner: string,
    poll_id: string,
    text: string,
    thread_message_id: string,
    participants: { user_id: string }[],
    workspace?: string,
    reply_count?: number
}

export type GetThreadsReturnType = {
    message: ThreadMessage[]
}

