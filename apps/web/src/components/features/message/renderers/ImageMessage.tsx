import { useState, useRef } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@lib/utils"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import _ from "@lib/translate"
import { ReservedImage } from "./ReservedImage"

export interface ImageFile {
    name: string
    file_name: string
    file_url: string
    file_size: string
    file_type: string
    file_thumbnail?: string
    /** Stored dimensions — used to reserve the image box before load. */
    width?: number
    height?: number
    /** The Raven Message this image belongs to — lets action delegation target it. */
    message_id?: string
}

export const ImageCarousel = ({ images, onImageClick }: { images: ImageFile[], onImageClick: (image: ImageFile) => void }) => {

    const [currentIndex, setCurrentIndex] = useState(0)
    const [isHovered, setIsHovered] = useState(false)
    const carouselRef = useRef<HTMLDivElement>(null)

    const nextImage = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    const prevImage = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    // Keyboard navigation — only while this specific carousel is hovered
    useHotkeys("left", prevImage, { enabled: isHovered, preventDefault: true })
    useHotkeys("right", nextImage, { enabled: isHovered, preventDefault: true })

    // Touch swipe to page — same discrete start/end delta as the lightbox (two
    // events per swipe, nothing per-frame). Horizontal-dominant only, so normal
    // vertical stream scrolling over the carousel is untouched.
    const touchStart = useRef<{ x: number; y: number } | null>(null)
    const onTouchStart = (event: React.TouchEvent) => {
        const touch = event.touches[0]
        touchStart.current = { x: touch.clientX, y: touch.clientY }
    }
    const onTouchEnd = (event: React.TouchEvent) => {
        const start = touchStart.current
        touchStart.current = null
        if (!start) return
        const touch = event.changedTouches[0]
        const dx = touch.clientX - start.x
        const dy = touch.clientY - start.y
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) nextImage()
            else prevImage()
        }
    }

    const currentImage = images[currentIndex]

    return (
        <div
            ref={carouselRef}
            className="relative group"
            tabIndex={0}
            role="region"
            aria-label={_("Image carousel")}
            aria-live="polite"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* Main Image — fixed 3:2 box so the carousel never resizes between slides.
                Slides are a VIEWING surface: object-contain shows the whole image,
                letterboxed on the gray backing (grids stay object-cover — previews crop). */}
            <div
                data-message-id={currentImage.message_id}
                className="relative aspect-[3/2] cursor-pointer overflow-hidden rounded-lg bg-surface-gray-1"
                onClick={() => onImageClick(images[currentIndex])}
            >
                <ReservedImage
                    src={currentImage.file_thumbnail || currentImage.file_url}
                    alt={currentImage.file_name}
                    className="object-contain"
                />

                {/* Navigation arrows */}
                {images.length > 1 && (
                    <>
                        <Button
                            variant="subtle"
                            size="sm"
                            isIconButton
                            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                            onClick={(e) => {
                                e.stopPropagation()
                                prevImage()
                            }}
                            title={_("Previous image")}
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            variant="subtle"
                            size="sm"
                            isIconButton
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                            onClick={(e) => {
                                e.stopPropagation()
                                nextImage()
                            }}
                            title={_("Next image")}
                        >
                            <ChevronRight />
                        </Button>
                    </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                    <Badge size="md" variant="solid" theme="gray" className="absolute top-2 right-2 z-10">
                        {currentIndex + 1} / {images.length}
                    </Badge>
                )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
                <div className="flex gap-1 mt-2 overflow-x-auto">
                    {images.map((image, index) => (
                        <Tooltip key={image.name}>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn(
                                        "shrink-0 cursor-pointer border-2 rounded overflow-hidden transition-all duration-200",
                                        index === currentIndex
                                            ? "border-outline-blue-4"
                                            : "border-transparent hover:border-outline-gray-2"
                                    )}
                                    onClick={() => setCurrentIndex(index)}
                                >
                                    <img
                                        src={image.file_thumbnail || image.file_url}
                                        alt={image.file_name}
                                        className="w-12 h-12 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>{image.file_name}</TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            )}
        </div>
    )
}

export const ImageGrid = ({ images, onImageClick }: { images: ImageFile[], onImageClick: (image: ImageFile) => void }) => {
    const displayImages = images.slice(0, 4)
    const layout = albumLayout(displayImages)

    return (
        // WhatsApp-style: each tile rounds itself (smaller radius than a single
        // image — signals "part of a set"), gaps show the page background as
        // clean separation lines. No borders.
        <div className={cn("grid gap-1", layout.container)}>
            {displayImages.map((image, index) => (
                <div
                    key={image.name}
                    data-message-id={image.message_id}
                    // bg: mats transparent-edged images (PNG logos/screenshots) —
                    // invisible behind opaque photos
                    className={cn(
                        "relative cursor-pointer overflow-hidden rounded-md bg-surface-gray-2 group",
                        layout.tiles[index],
                    )}
                    onClick={() => onImageClick(image)}
                >
                    <ReservedImage
                        src={image.file_thumbnail || image.file_url}
                        alt={image.file_name}
                    />
                </div>
            ))}
        </div>
    )
}

type Orientation = "wide" | "tall" | "square"

const orientationOf = (image: ImageFile): Orientation => {
    if (!image.width || !image.height) return "square"
    const ratio = image.width / image.height
    if (ratio > 1.2) return "wide"
    if (ratio < 0.8) return "tall"
    return "square"
}

/**
 * Telegram/WhatsApp-style aspect-aware album templates. Send order is always
 * preserved — only the arrangement adapts to the images' orientations. Every
 * slot has a fixed aspect derived from the stored dimensions, so the album's
 * geometry is fully determined before any image loads.
 */
const albumLayout = (images: ImageFile[]): { container: string; tiles: string[] } => {
    const count = images.length
    const first = orientationOf(images[0])

    if (count === 2) {
        const second = orientationOf(images[1])
        // Two landscapes stack; two portraits sit side by side at portrait aspect
        if (first === "wide" && second === "wide") {
            return { container: "grid-cols-1", tiles: ["aspect-[2/1]", "aspect-[2/1]"] }
        }
        if (first === "tall" && second === "tall") {
            return { container: "grid-cols-2", tiles: ["aspect-[3/4]", "aspect-[3/4]"] }
        }
        return { container: "grid-cols-2", tiles: ["aspect-square", "aspect-square"] }
    }

    if (count === 3) {
        // Landscape lead goes on top full-width; portrait/square lead goes tall-left
        if (first === "wide") {
            return { container: "grid-cols-2", tiles: ["col-span-2 aspect-[2/1]", "aspect-square", "aspect-square"] }
        }
        return { container: "grid-cols-2", tiles: ["row-span-2 h-full", "aspect-square", "aspect-square"] }
    }

    // 4 images: landscape lead gets a cinematic top row, otherwise a 2×2 grid
    if (first === "wide") {
        return {
            container: "grid-cols-3",
            tiles: ["col-span-3 aspect-[21/9]", "aspect-square", "aspect-square", "aspect-square"],
        }
    }
    return {
        container: "grid-cols-2",
        tiles: ["aspect-square", "aspect-square", "aspect-square", "aspect-square"],
    }
}

