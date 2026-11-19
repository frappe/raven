import type { Message } from "@raven/types/common/Message"
import { parseVoiceJson } from "@lib/voiceNote"

/**
 * The replied-to message's snapshot, byte-compatible with the server's
 * (RavenMessage.before_insert) so the preview doesn't change on ack.
 */
export const buildReplySnapshot = (message: Message | null | undefined): string | undefined => {
    if (!message) return undefined
    const voice = message.message_type === "Voice" ? parseVoiceJson(message.json) : null
    return JSON.stringify({
        content: message.content ?? "",
        file: (message as Message & { file?: string }).file ?? "",
        message_type: message.message_type,
        owner: message.owner,
        creation: message.creation,
        ...(voice ? { json: voice } : {}),
    })
}
