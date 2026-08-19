import type { Message } from "@raven/types/common/Message"

/**
 * A message that may carry a file attachment — the shape every file-action surface
 * (copy link, download, attach-to-document, delete preview) reads. Named distinctly
 * from `@raven/types/common/Message`'s own exported `FileMessage` (a narrower,
 * already-discriminated union member) to avoid a collision when both are imported
 * together.
 */
export type FileBearingMessage = Message & { file?: string; file_size?: number }

/**
 * True when `message` actually carries a file (File/Image message_type with a
 * non-empty `file`). The one predicate every file-action surface filters batch
 * members through — a batch's caption (a plain Text message, always the LAST
 * member) must never be mistaken for an attachable file.
 */
export const hasFile = (message: Message): message is FileBearingMessage & { file: string } => {
    const file = (message as FileBearingMessage).file
    return !!file && (message.message_type === "File" || message.message_type === "Image")
}
