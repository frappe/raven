import { BarChart3Icon, File, FileText, Film, MessageSquareText, Music, type LucideIcon } from "lucide-react"
import { getAttachmentKind, type AttachmentKind } from "@utils/attachmentPreview"
import { formatBytes, getFileExtension } from "@lib/file"
import { getFileName } from "@raven/lib/utils/operations"
import { type FileBearingMessage } from "../fileMessage"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import FileTypeIcon from "@components/common/FileIcons/FileTypeIcon"

type MediaMessage = FileBearingMessage & { file_thumbnail?: string }

const KIND_ICON: Record<Exclude<AttachmentKind, "image">, LucideIcon> = {
    video: Film,
    audio: Music,
    pdf: FileText,
    file: File,
}

const KIND_LABEL: Record<AttachmentKind, string> = {
    image: _("Image"),
    video: _("Video"),
    audio: _("Audio"),
    pdf: _("PDF"),
    file: _("File"),
}

/** Plain text for previews — backend `content` joins blocks with spaces, so derive from HTML when present. */
const getMessagePreviewText = (message: Message): string => {
    const html = "text" in message ? message.text : undefined
    if (html?.trim()) {
        const withBreaks = html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/(?:p|div|li|blockquote|tr|h[1-6])>/gi, "\n")
        const plain = new DOMParser().parseFromString(withBreaks, "text/html").body.textContent ?? ""
        const cleaned = plain.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
        // Fall through when empty (e.g. an emoji-/image-only message) so the preview isn't blank.
        if (cleaned) return cleaned
    }
    return message.content?.trim() || _("Message")
}

/**
 * Compact preview of one message: an image thumbnail, or a kind-icon tile plus
 * filename and `Kind · size` for any other file, or a text snippet.
 *
 * Shared by the delete and attach-to-document dialogs — both show the same row in
 * a single-message card and in a batch checklist, and keeping one component is what
 * stops the two from drifting apart. Attach only ever passes file-bearing messages
 * (it filters through `hasFile` first), so the text branch is dead there; delete
 * needs it, since deleting a batch legitimately includes its caption.
 *
 * Renders a FRAGMENT — the caller owns the row, its padding and its flex/gap.
 */
export const MessagePreview = ({ message }: { message: Message }) => {
    const media = message as MediaMessage
    const file = media.file

    if (file) {
        const extension = getFileExtension(file)
        const kind = getAttachmentKind(file)
        const name = getFileName(file)
        const size = media.file_size ? formatBytes(media.file_size) : null
        const meta = [KIND_LABEL[kind], size].filter(Boolean).join(" · ")
        const Icon = kind === "image" ? null : KIND_ICON[kind]
        return (
            <>
                {kind === "image" || !Icon ? (
                    <img
                        src={media.file_thumbnail || file}
                        alt={name}
                        loading="lazy"
                        className="size-8 shrink-0 rounded-sm object-cover bg-surface-gray-3"
                    />
                ) : (
                    <FileTypeIcon fileType={extension} size="xl" />
                )}
                <div className="min-w-0 flex gap-1 flex-col">
                    <p className="truncate text-sm leading-snug text-ink-gray-8">{name}</p>
                    <p className="truncate text-xs text-ink-gray-5">{meta}</p>
                </div>
            </>
        )
    }
    return (
        <>
            <div className="flex size-8 shrink-0 items-center justify-center rounded bg-surface-gray-2 text-ink-gray-6">
                {message.message_type === "Poll" ? <BarChart3Icon className="size-4" /> : <MessageSquareText className="size-4" />}
            </div>
            <p className="min-w-0 flex-1 text-p-sm text-ink-gray-7 whitespace-pre-wrap wrap-break-words line-clamp-2">{getMessagePreviewText(message)}</p>
        </>
    )
}
