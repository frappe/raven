import { MapPin } from "lucide-react"
import { cn } from "@lib/utils"

/** The one map marker: Lucide's MapPin, filled, with its tip (y 22 of 24) on the container centre. */
export const PinMarker = ({ lifted = false, className }: { lifted?: boolean; className?: string }) => (
    <MapPin
        aria-hidden="true"
        className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 size-9 fill-current text-ink-red-6 transition-transform duration-150 [&_circle]:fill-white",
            className,
        )}
        style={{
            transform: lifted
                ? "translate(-50%, calc(-22 / 24 * 100% - 8px))"
                : "translate(-50%, calc(-22 / 24 * 100%))",
        }}
    />
)
