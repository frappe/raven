import type { Message } from "@raven/types/common/Message"
import { fitImageBox } from "./ReservedImage"
import { useFileSrc } from "@hooks/useFileSrc"

type VideoLikeMessage = Message & {
    file?: string
    thumbnail_width?: number
    thumbnail_height?: number
}

/**
 * Inline video players for one message or a batch's video members.
 *
 * When dimensions are stored (measured in the composer at attach time — see
 * measureMediaDimensions), the box is reserved at the real aspect before
 * anything loads: portrait screen recordings and landscape clips alike, no
 * scroll shift. Without them (older messages, other clients, unreadable
 * codecs) the video sizes to its natural aspect when metadata arrives — the
 * old one-time reflow, kept as the fallback.
 */
export const MessageVideo = ({ messages }: { messages: Message[] }) => (
    <div className="space-y-1">
        {(messages as VideoLikeMessage[]).map((message, index) => (
            <VideoCard key={`${message.file ?? message.name}:${index}`} message={message} />
        ))}
    </div>
)

const VideoCard = ({ message }: { message: VideoLikeMessage }) => {
    const hasDims = Boolean(message.thumbnail_width && message.thumbnail_height)
    // Mobile WebViews paint no frame for preload="metadata"; the fragment makes them seek and paint one.
    const src = useFileSrc(message.file)
    return (
        <div data-message-id={message.name} data-media-root="" className="max-w-md lg:max-w-lg">
            <video
                src={src && `${src}#t=0.001`}
                playsInline
                controls
                preload="metadata"
                // 448×384 caps = the container's max-w-md and the old
                // max-h-96, so reserved boxes match the fallback's bounds.
                style={hasDims ? fitImageBox(message.thumbnail_width, message.thumbnail_height, 448, 384) : undefined}
                className="max-h-96 max-w-full rounded-lg bg-surface-gray-2"
            />
        </div>
    )
}
