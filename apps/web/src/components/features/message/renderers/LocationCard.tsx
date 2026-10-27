import { useState, type ComponentPropsWithoutRef, type Ref } from "react"
import { PinMarker } from "@components/common/PinMarker"
import { MAP_CREDIT_TEXT } from "@lib/location"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

const cardClass =
    "relative block w-60 max-w-full overflow-hidden rounded-md border border-outline-gray-2 bg-surface-gray-2"

const interactiveClass =
    "cursor-pointer outline-none transition-colors hover:border-outline-gray-3 focus-visible:focus-ring"

type LocationCardProps = {
    snapshotUrl?: string
    /** Width / height of the box (3:2, Apple Maps' preview shape). */
    aspect?: number
    /** Overlay the pin at the centre (only when the image shows). */
    pin?: boolean
    /** Overlay the OSM credit (only when the image shows). */
    credit?: boolean
    /** How the image fills the box; map links contain so no provider artwork is cropped. */
    fit?: "cover" | "contain"
    onOpen?: () => void
    ref?: Ref<HTMLButtonElement>
} & Omit<ComponentPropsWithoutRef<"button">, "onClick" | "type" | "children">

/** The map card: a snapshot (or the red pin on a grey box) with optional pin and OSM-credit overlays; used by Location messages and map links. */
export const LocationCard = ({
    snapshotUrl,
    aspect = 3 / 2,
    pin = false,
    credit = false,
    fit = "cover",
    onOpen,
    ref,
    ...buttonProps
}: LocationCardProps) => {
    const [failedSnapshot, setFailedSnapshot] = useState<string | null>(null)
    const showSnapshot = !!snapshotUrl && snapshotUrl !== failedSnapshot
    const card = (
        <>
            {showSnapshot ? (
                <img
                    src={snapshotUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={cn("size-full", fit === "contain" ? "object-contain" : "object-cover")}
                    onError={() => setFailedSnapshot(snapshotUrl)}
                />
            ) : (
                <PinMarker />
            )}
            {showSnapshot && pin && <PinMarker />}
            {showSnapshot && credit && (
                <span className="absolute bottom-0 right-0 bg-surface-base px-1 text-2xs leading-4 text-ink-gray-7">
                    {MAP_CREDIT_TEXT}
                </span>
            )}
        </>
    )

    if (onOpen) {
        return (
            <button
                {...buttonProps}
                ref={ref}
                type="button"
                aria-label={_("Open location in maps")}
                onClick={onOpen}
                style={{ aspectRatio: aspect }}
                className={cn(cardClass, interactiveClass)}
            >
                {card}
            </button>
        )
    }

    return (
        <div role="img" aria-label={_("Location")} style={{ aspectRatio: aspect }} className={cardClass}>
            {card}
        </div>
    )
}
