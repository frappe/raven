import { useState, type ComponentPropsWithoutRef, type Ref } from "react"
import { ExternalLink, MapPin } from "lucide-react"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

const cardClass =
    "flex w-full max-w-[420px] items-center gap-3 rounded-xl border border-outline-gray-2 bg-surface-base p-1.5"

const interactiveClass =
    "cursor-pointer text-left outline-none transition-colors hover:bg-surface-gray-1 hover:border-outline-gray-3 active:bg-surface-gray-2 focus-visible:focus-ring"

type LocationCardProps = {
    snapshotUrl?: string
    onOpen?: () => void
    ref?: Ref<HTMLButtonElement>
} & Omit<ComponentPropsWithoutRef<"button">, "onClick" | "type" | "children">

/** The compact Location row: snapshot or pin, "Location", and an open-in-maps affordance. */
export const LocationCard = ({ snapshotUrl, onOpen, ref, ...buttonProps }: LocationCardProps) => {
    const [failedSnapshot, setFailedSnapshot] = useState<string | null>(null)
    const showSnapshot = !!snapshotUrl && snapshotUrl !== failedSnapshot
    const interactive = !!onOpen
    const card = (
        <>
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-gray-2">
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
                    <MapPin className="size-5 text-ink-gray-5" aria-hidden="true" />
                )}
            </div>
            <span className="min-w-0 flex-1 truncate text-base font-medium text-ink-gray-8 md:text-sm">
                {_("Location")}
            </span>
            {interactive && <ExternalLink className="size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />}
        </>
    )

    if (interactive) {
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

    return <div className={cardClass}>{card}</div>
}
