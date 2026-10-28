import { useState, type ComponentPropsWithoutRef, type Ref } from "react"
import { PinMarker } from "@components/common/PinMarker"
import { MAP_CREDIT_TEXT } from "@lib/location"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

const cardClass =
    "relative block w-60 max-w-full aspect-3/2 overflow-hidden rounded-md border border-outline-gray-2 bg-surface-gray-2"

const interactiveClass =
    "cursor-pointer outline-none transition-colors hover:border-outline-gray-3 focus-visible:focus-ring"

type LocationCardProps = {
    snapshotUrl?: string
    onOpen?: () => void
    ref?: Ref<HTMLButtonElement>
} & Omit<ComponentPropsWithoutRef<"button">, "onClick" | "type" | "children">

/** The Location card: the map snapshot with our pin and OSM credit (or a pin placeholder). */
export const LocationCard = ({ snapshotUrl, onOpen, ref, ...buttonProps }: LocationCardProps) => {
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
                    className="size-full object-cover"
                    onError={() => setFailedSnapshot(snapshotUrl)}
                />
            ) : (
                <PinMarker />
            )}
            {showSnapshot && <PinMarker />}
            {showSnapshot && (
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
                className={cn(cardClass, interactiveClass)}
            >
                {card}
            </button>
        )
    }

    return (
        <div role="img" aria-label={_("Location")} className={cardClass}>
            {card}
        </div>
    )
}
