import { atom } from "jotai"
import dayjs from "dayjs"
import { getFileName } from "@raven/lib/utils/operations"
import { getFileExtension } from "@lib/file"
import type { Message } from "@raven/types/common/Message"

/**
 * How a message file presents: `image` <img>, `video` <video>, `audio`
 * <audio>, `pdf` <embed> (desktop) with a mobile download fallback, `file` =
 * no inline preview, just a download card (Google-Drive style). Classified by
 * file EXTENSION, not the coarse Raven message_type.
 */
export type AttachmentKind = "image" | "video" | "audio" | "pdf" | "file"

// Extension → kind. Only what browsers can actually render inline; everything
// else falls through to a download card.
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "jfif", "apng"])
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "m4v", "mov"])
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba"])

/** Classify a file by its extension (query string already stripped by getFileExtension). */
export const getAttachmentKind = (url: string): AttachmentKind => {
    const extension = getFileExtension(url)
    if (IMAGE_EXTENSIONS.has(extension)) return "image"
    if (VIDEO_EXTENSIONS.has(extension)) return "video"
    if (AUDIO_EXTENSIONS.has(extension)) return "audio"
    if (extension === "pdf") return "pdf"
    return "file"
}

/** Display/paging order — images first, then video, audio, and docs/files last. */
const KIND_ORDER: Record<AttachmentKind, number> = { image: 0, video: 1, audio: 2, pdf: 3, file: 4 }

export interface Attachment {
    /** The owning Raven Message id — unique within a set. */
    id: string
    fileName: string
    fileUrl: string
    kind: AttachmentKind
    /** Image thumbnail; absent for PDFs (the filmstrip shows an icon tile instead). */
    thumbnail?: string
    /** Stored image dimensions, when known. */
    width?: number
    height?: number
    /** File size in bytes, when known — shown as a badge in the viewer header. */
    size?: number
    /** Sender + timestamp of the message, for the viewer's header. */
    owner: string
    creation: string
}

/**
 * The single, app-wide attachment viewer state: the navigable set (one batch
 * /album worth) plus the current index. Null = closed. One `<AttachmentPreviewModal>`
 * mounted at the app shell reads this, so any surface — the stream, a thread
 * drawer, the saved-messages list — opens the same viewer via the setter.
 */
/**
 * `view` (default): a sent message's attachment — sender, timestamp, download/share.
 * `preview`: a composer-staged file before sending — no author/actions, a "Preview"
 * badge, and (later) editing affordances like crop. Same lightbox + paging logic.
 */
export type AttachmentPreviewMode = "view" | "preview"

export type AttachmentPreviewState = {
    attachments: Attachment[]
    index: number
    mode?: AttachmentPreviewMode
    /**
     * Identifies the surface that opened the viewer (e.g. "channel-files:{id}").
     * A source uses it to recognize its own session in the atom — so it can
     * append pages to `attachments` or strip its callbacks on unmount without
     * touching a viewer some other surface opened. Plain snapshot openers
     * (the message stream) leave all of this unset and nothing changes.
     */
    sourceKey?: string
    /** Called after paging lands on an item — the source syncs its list scroll. */
    onIndexChange?: (attachment: Attachment) => void
    /**
     * Called when paging gets close to the end of `attachments` while
     * `hasMore` — the source loads its next page and rewrites `attachments`.
     * The viewer itself never fetches.
     */
    onNearEnd?: () => void
    /** More items exist beyond the set → paging clamps at the ends instead of wrapping. */
    hasMore?: boolean
} | null

export const attachmentPreviewAtom = atom<AttachmentPreviewState>(null)

/** Message fields the attachment builder reads (Image/File messages). */
type MediaMessage = Message & {
    file?: string
    file_thumbnail?: string
    thumbnail_width?: number
    thumbnail_height?: number
    file_size?: number
}

const toAttachment = (message: Message): Attachment | null => {
    const media = message as MediaMessage
    const url = media.file
    if (!url) return null

    const kind = getAttachmentKind(url)
    const base = {
        id: media.name,
        fileName: getFileName(url),
        fileUrl: new URL(url, window.location.origin).href,
        size: media.file_size,
        owner: media.owner,
        creation: media.creation,
    }

    if (kind === "image") {
        return { ...base, kind, thumbnail: media.file_thumbnail, width: media.thumbnail_width, height: media.thumbnail_height }
    }
    return { ...base, kind }
}

/**
 * The ordered, navigable attachment set for a group of messages — a batch (so
 * a mixed batch becomes ONE set you can arrow across) or a single message.
 * EVERY file is included (non-previewable types page in as a download card),
 * ordered by kind (images, video, audio, then docs) to match the in-message
 * layout. Per-pill tap behavior (e.g. a PDF opening in a new tab on mobile)
 * lives in the renderer; the set itself is platform-agnostic so paging is
 * complete on every device.
 */
export const messagesToAttachments = (messages: Message[]): Attachment[] => {
    const attachments = messages
        .map(toAttachment)
        .filter((attachment): attachment is Attachment => attachment !== null)
    // Stable sort by kind — order within a kind is preserved
    return attachments.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
}

/** A composer-staged (already-uploaded) file, enough to preview it. */
export interface StagedFile {
    id: string
    fileName: string
    fileURL: string
    size: number
    timestamp: number
}

/**
 * Build the viewer set from the composer's staged (uploaded) files, so a file can
 * be previewed before it's sent. Kept in the SAME order the file list shows them so
 * a clicked index lines up (NOT kind-sorted like messagesToAttachments). owner is the
 * current user; creation is the upload time, just for the viewer header.
 */
export const stagedFilesToAttachments = (files: StagedFile[], owner: string): Attachment[] =>
    files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileUrl: new URL(file.fileURL, window.location.origin).href,
        kind: getAttachmentKind(file.fileURL),
        size: file.size,
        owner,
        creation: dayjs(file.timestamp).format("YYYY-MM-DD HH:mm:ss"),
    }))
