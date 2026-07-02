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
    const images = messages.map((message) => toImageFile(message as ImageLikeMessage))
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

                    {/* EXPERIMENT: stacked-card layout replaces the grid/carousel.
                        Original branch preserved below — restore by deleting <ImageStack/>
                        and uncommenting this block. */}
                    {/* TODO(image-stack): put ImageStack behind a feature flag, and only
                        mount it when the message scrolls into the viewport (IntersectionObserver).
                        Until mounted, render a placeholder sized from the SAME bounding-box
                        aspect ratio ImageStack derives (responsive width + aspectRatio from
                        the cards' stored dims) so the row height is reserved and deterministic
                        — no layout shift when the real stack swaps in. */}
                    {imageGrouping === 'grid' ? (
                        images.length <= 4 ? (
                            <ImageGrid images={images} onImageClick={openImage} />
                        ) : (
                            <ImageCarousel images={images} onImageClick={openImage} />
                        )) : <ImageStack images={images} onImageClick={openImage} />}


                </div>
            )}
        </>
    )
}
