import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@lib/utils"

/**
 * An image that NEVER changes size: the parent supplies a fixed box (computed
 * from the stored thumbnail dimensions) and this fills it — a flat gray
 * placeholder fading to the real image when its bytes arrive.
 *
 * This is what keeps message heights deterministic: the scroll engine's
 * compensation assumes no element resizes itself after paint.
 */
export const ReservedImage = ({
    src,
    alt,
    className,
}: {
    src: string
    alt: string
    className?: string
}) => {
    const [loaded, setLoaded] = useState(false)
    const imgRef = useRef<HTMLImageElement>(null)

    // An already-cached image shows at once, no fade. Without this, any
    // REMOUNT of the same image replayed the fade from transparent — most
    // visibly when the server ack replaces an optimistic message (new React
    // key, same file URL) and the just-sent photo blinked. Layout effect so
    // the check runs before paint: the transparent frame never shows.
    useLayoutEffect(() => {
        const img = imgRef.current
        setLoaded(Boolean(img && img.complete && img.naturalWidth > 0))
    }, [src])

    return (
        <div className="relative h-full w-full overflow-hidden">
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                className={cn(
                    "h-full w-full object-cover transition-opacity duration-300",
                    loaded ? "opacity-100" : "opacity-0",
                    className,
                )}
            />
        </div>
    )
}

/**
 * Fits an image's stored dimensions into the stream's display bounds while
 * preserving aspect ratio. Returns a style with explicit width + aspect-ratio
 * so the box is fully determined before the image loads. Falls back to a
 * fixed 4:3 box when dimensions are missing (old messages).
 */
export const fitImageBox = (width?: number, height?: number, maxWidth = 480, maxHeight = 384) => {
    if (!width || !height) {
        return { width: 320, aspectRatio: "4 / 3" }
    }
    const scale = Math.min(maxWidth / width, maxHeight / height, 1)
    return { width: Math.round(width * scale), aspectRatio: `${width} / ${height}` }
}
