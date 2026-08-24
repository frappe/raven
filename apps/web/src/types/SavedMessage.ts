import { ThreadMessage } from "./ThreadMessage"

export type SavedMessageStatus = 'in_progress' | 'archived' | 'completed'

// Base saved message fields
export type SavedMessageBase = {
    saved_at: string
    status: SavedMessageStatus
    reminder_date?: string
    reminder_time?: string
    reminder_description?: string
}

// Regular message (not a thread)
export type SavedRegularMessage = {
    name: string
    owner: string
    channel_id: string
    creation: string
    text?: string
    content?: string
    message_type: "Text" | "Image" | "File" | "Poll"
    is_thread: 0 | 1
    is_bot_message?: 0 | 1
    bot?: string
    reply_count?: number
    participants?: { user_id: string }[]
} & SavedMessageBase

// Thread message
export type SavedThreadMessage = ThreadMessage & SavedMessageBase

// Union type for saved messages
export type SavedMessage = SavedRegularMessage | SavedThreadMessage

export type GetSavedMessagesReturnType = {
    message: SavedMessage[]
}

