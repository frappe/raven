import { XIcon } from "lucide-react"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/** Clear (×) for pickers — a SIBLING of the trigger (button-in-button is invalid markup),
    absolutely positioned where the chevron sits; pair with pr-7 on the trigger. */
const ClearFieldButton = ({ onClick, ariaLabel, className }: {
    onClick: () => void
    ariaLabel?: string
    className?: string
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? _("Clear")}
        className={cn("absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-ink-gray-5 hover:bg-surface-gray-4 hover:text-ink-gray-8", className)}
    >
        <XIcon className="size-3.5" />
    </button>
)

export default ClearFieldButton
