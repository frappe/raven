import { useMemo } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { getFileName } from "@raven/lib/utils/operations"
// EXPERIMENT: grid/carousel layout swapped for the stacked-card layout (ImageStack).
// Original imports kept (commented) so the previous behaviour is one revert away.
import { ImageCarousel, ImageGrid } from "./ImageMessage"
import { type ImageFile } from "./ImageMessage"
import { ImageStack } from "./ImageStack"
import { ReservedImage, fitImageBox } from "./ReservedImage"
import { attachmentPreviewAtom, messagesToAttachments, type Attachment } from "@utils/attachmentPreview"
import type { Message } from "@raven/types/common/Message"
import { imageGroupingLayoutAtom } from "@utils/preferences"

/** A message whose `message_type` is Image — the fields the renderer needs. */
type ImageLikeMessage = Message & {
    file?: string
    file_thumbnail?: string
    thumbnail_width?: number
    thumbnail_height?: number
}

const toImageFile = (message: ImageLikeMessage): ImageFile => ({
    name: message.name,
    file_name: getFileName(message.file ?? ""),
    file_url: message.file ?? "",
    file_size: "",
    file_type: "image",
    file_thumbnail: message.file_thumbnail,
    width: message.thumbnail_width,
    height: message.thumbnail_height,
    message_id: message.name,
})

/**
 * Renders the images of one message or one batch: a single reserved box, a
 * grid (2–4), or a carousel (5+). Clicking opens the shared attachment viewer
 * (atom-driven, app-level) at the clicked image. Every box is fully sized
 * before any image loads — message heights never change after paint.
 *
 * `attachments`: the batch's combined set (images + PDFs in send order),
 * passed by BatchMessageItem so a mixed batch pages as one. Omitted for a
 * standalone image message — it builds its own single-album set.
 */
export const MessageImages = ({ messages, attachments }: { messages: Message[]; attachments?: Attachment[] }) => {
    // Memoised on the messages array (reference-stable from the store while the
    // batch is unchanged) — a stable `images` also keeps ImageStack/Grid props
    // stable, so unrelated row re-renders don't re-derive per-image objects.
    const images = useMemo(() => messages.map((message) => toImageFile(message as ImageLikeMessage)), [messages])
    const setPreview = useSetAtom(attachmentPreviewAtom)

    const ownSet = useMemo(() => messagesToAttachments(messages), [messages])
    const previewSet = attachments ?? ownSet

    const openImage = (image: ImageFile) => {
        const index = previewSet.findIndex((attachment) => attachment.id === image.name)
        if (index !== -1) setPreview({ attachments: previewSet, index })
    }

    const single = images.length === 1 ? images[0] : null

    const imageGrouping = useAtomValue(imageGroupingLayoutAtom)

    return (
        <>
            {single ? (
                // max-w-full: on narrow columns the box clamps and aspect-ratio
                // keeps the height proportional — still fully deterministic
                <div
                    // message_id: in a mixed batch a lone image renders here while
                    // the row belongs to the whole batch — delegation needs the member
                    data-message-id={single.message_id}
                    data-media-root=""
                    className="max-w-full cursor-pointer overflow-hidden rounded-lg"
                    style={fitImageBox(single.width, single.height)}
                    onClick={() => openImage(single)}
                >
                    <ReservedImage src={single.file_thumbnail || single.file_url} alt={single.file_name} />
                </div>
            ) : (
                // Inline media caps at a reading-friendly width by design (the modal
                // is the big-screen surface); desktops get a modestly higher cap
                <div data-media-root="" className="max-w-md lg:max-w-lg">

                    {/* image-stack: only mount ImageStack when the message scrolls
                        into the viewport (IntersectionObserver). Until mounted, render a
                        placeholder sized from the SAME bounding-box aspect ratio ImageStack
                        derives (responsive width + aspectRatio from the cards' stored dims)
                        so the row height is reserved and deterministic — no layout shift
                        when the real stack swaps in. */}
                    {/* 5+ images always use the carousel — a stack that hides most of a
                        big album behind a "+N" (or a grid that tiles it tiny) serves it
                        worse than paging. The layout preference only decides how SMALL
                        albums (2-4) render: classic grid or the stacked pile. */}
                    {images.length > 4 ? (
                        <ImageCarousel images={images} onImageClick={openImage} />
                    ) : imageGrouping === "grid" ? (
                        <ImageGrid images={images} onImageClick={openImage} />
                    ) : (
                        <ImageStack images={images} onImageClick={openImage} />
                    )}


                </div>
            )}
        </>
    )
}
