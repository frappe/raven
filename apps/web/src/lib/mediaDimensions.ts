import { getAttachmentKind } from "@utils/attachmentPreview"

export type MediaDimensions = { width: number; height: number }

/**
 * Read a video file's display size from its container header, in the browser.
 *
 * Why here and not the server: the server has no video decoder (PIL is
 * images-only), while the browser ships a demuxer for exactly the formats it
 * will later play. `loadedmetadata` parses only the header — milliseconds,
 * even for a huge file — and videoWidth/Height come rotation-applied, so a
 * portrait phone recording reports portrait, matching how the <video> element
 * will render it.
 *
 * Resolves null for unplayable codecs or a parse that takes suspiciously
 * long — callers just fall back to the unreserved layout.
 */
const measureVideo = (file: File): Promise<MediaDimensions | null> =>
    new Promise((resolve) => {
        const url = URL.createObjectURL(file)
        const video = document.createElement("video")
        let settled = false
        const done = (result: MediaDimensions | null) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            URL.revokeObjectURL(url)
            video.removeAttribute("src")
            resolve(result)
        }
        // Header parsing is near-instant from a local file; anything this slow
        // is a codec the browser can't read.
        const timer = window.setTimeout(() => done(null), 5000)
        video.preload = "metadata"
        video.onloadedmetadata = () =>
            done(video.videoWidth > 0 && video.videoHeight > 0 ? { width: video.videoWidth, height: video.videoHeight } : null)
        video.onerror = () => done(null)
        video.src = url
    })

/**
 * Read an image file's display size — for the OPTIMISTIC placeholder only.
 * The server measures images itself at insert and stays authoritative; this
 * just lets a just-sent image reserve its real box instead of snapping from
 * the generic 4:3 fallback when the server ack lands. naturalWidth/Height
 * come EXIF-oriented in modern browsers, matching the server's
 * exif_transpose. Null (SVG, unreadable) falls back as before.
 */
const measureImage = (file: File): Promise<MediaDimensions | null> =>
    new Promise((resolve) => {
        const url = URL.createObjectURL(file)
        const image = new Image()
        const done = (result: MediaDimensions | null) => {
            URL.revokeObjectURL(url)
            resolve(result)
        }
        image.onload = () =>
            done(image.naturalWidth > 0 && image.naturalHeight > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : null)
        image.onerror = () => done(null)
        image.src = url
    })

/**
 * Display size for an attached media file — video or image — or null for
 * everything else. The composer calls this at attach time and the dims ride
 * the send (see UploadedFile.width/height), so the message — and its
 * optimistic placeholder — can reserve the display box before anything loads.
 */
export const measureMediaDimensions = (file: File): Promise<MediaDimensions | null> => {
    if (file.type.startsWith("video/") || getAttachmentKind(file.name) === "video") {
        return measureVideo(file)
    }
    if (file.type.startsWith("image/") || getAttachmentKind(file.name) === "image") {
        return measureImage(file)
    }
    return Promise.resolve(null)
}
