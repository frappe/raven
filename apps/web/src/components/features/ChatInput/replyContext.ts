import type { Message } from "@raven/types/common/Message"

/**
 * What a send carries when it replies: the linked message id plus a snapshot of it,
 * so the reply preview renders before the server confirms.
 */
export const replyContext = (replyTo: Message | null): { linkedMessage?: string; repliedMessageDetails?: string } => ({
    linkedMessage: replyTo?.name,
    repliedMessageDetails: replyTo
        ? JSON.stringify({
            // No `text` (HTML): the server's snapshot doesn't store it and the
            // preview renders `content`, so this stays byte-compatible with what
            // the server sends back when the send is confirmed.
            content: replyTo.content ?? "",
            file: (replyTo as typeof replyTo & { file?: string }).file ?? "",
            message_type: replyTo.message_type,
            owner: replyTo.owner,
            creation: replyTo.creation,
        })
        : undefined,
})
