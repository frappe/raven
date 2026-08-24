import { useMemo } from "react"
import { toast } from "sonner"
import { useSetAtom } from "jotai"
import FileMessage, { FileItem } from "@components/common/FileMessage/FileMessage"
import { formatBytes, getFileName } from "@raven/lib/utils/operations"
import { downloadFile, getFileExtension, shareFile } from "@lib/file"
import { useIsMobile } from "@hooks/use-mobile"
import { attachmentPreviewAtom, getAttachmentKind, messagesToAttachments, type Attachment } from "@utils/attachmentPreview"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"

/** A message whose `message_type` is File — the fields the renderer needs. */
type FileLikeMessage = Message & { file?: string; file_size?: number }

/**
 * Renders the file pills of one message or one batch. Clicking a pill opens the
 * shared viewer at that file — except a PDF on mobile, which opens in a new tab
 * (the native full-screen viewer is the best way to read it there). PDFs/files
 * still live in the set, so paging a batch reaches them (as a download/open
 * card). Every pill carries its member's data-message-id and its own Download/Share.
 *
 * `attachments`: the batch's combined set, passed by BatchMessageItem so a
 * mixed batch pages as one. Omitted for a standalone file — it builds its own.
 */
export const MessageFiles = ({ messages, attachments }: { messages: Message[]; attachments?: Attachment[] }) => {
    const setPreview = useSetAtom(attachmentPreviewAtom)
    const isMobile = useIsMobile()

    const ownSet = useMemo(() => messagesToAttachments(messages), [messages])
    const previewSet = attachments ?? ownSet

    const toFileItem = (message: FileLikeMessage): FileItem => {
        const url = message.file ?? ""
        const fileName = getFileName(url)
        const extension = getFileExtension(url)
        return {
            messageId: message.name,
            fileName,
            fileType: extension,
            // file_size is denormalized onto the message at send (send_message_with_attachments).
            fileSize: message.file_size ? formatBytes(message.file_size) : undefined,
            onOpen: () => {
                const index = previewSet.findIndex((attachment) => attachment.id === message.name)
                if (index !== -1) setPreview({ attachments: previewSet, index })
            },
            onDownload: () => downloadFile(url, fileName),
            onShare: async () => {
                const result = await shareFile(url, fileName)
                if (result === "copied") toast.success(_("Link copied"))
                else if (result === "failed") toast.error(_("Could not copy link"))
            },
        }
    }

    return <FileMessage files={messages.map((message) => toFileItem(message as FileLikeMessage))} />
}
