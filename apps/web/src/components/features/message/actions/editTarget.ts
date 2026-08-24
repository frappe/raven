import { channelMessagesStore } from "@stores/messages/store"
import { isOptimistic } from "@stores/messages/types"
import type { Message } from "@raven/types/common/Message"

/**
 * The message whose text an Edit action should target, or null when nothing is
 * editable. A standalone text/caption message edits itself; a batch edits its
 * caption-bearing member (the only text in the block); polls and caption-less
 * file messages aren't editable.
 */
export const resolveEditTarget = (message: Message): Message | null => {
    if (message.message_type === "Poll") return null
    if (message.message_batch_id) {
        const members = channelMessagesStore.batchMembers(message.channel_id, message.message_batch_id)
        return members.find((member) => member.text) ?? null
    }
    return message.text ? message : null
}

/**
 * The current user's most recent message in a channel that can be edited inline,
 * or null. Scans newest→oldest, skipping system messages (not user-composed) and
 * still-sending optimistic ones, then applies {@link resolveEditTarget} to the
 * last message they actually sent. So Up-arrow edits the last message ONLY when
 * that message is itself editable (not a poll, not a caption-less file) — it does
 * not fall back to an older message. Used by the composer's "edit last" shortcut.
 */
export const getLastEditableMessage = (channelID: string, currentUser: string): Message | null => {
    const { byId, order } = channelMessagesStore.getState(channelID)
    for (let i = order.length - 1; i >= 0; i--) {
        const message = byId.get(order[i])
        if (!message || message.message_type === "System") continue
        if (message.owner !== currentUser || message.is_bot_message) continue
        // The last message still sending has no real name yet — nothing to edit.
        if (isOptimistic(message)) return null
        return resolveEditTarget(message)
    }
    return null
}
