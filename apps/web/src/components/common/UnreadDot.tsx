import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * The unread mark shared by the notification and thread cards: a small solid dot in
 * a wrapper one line tall, so it centres on whichever text line it sits in. Flows
 * inline by default; a caller can position it instead.
 */
export const UnreadDot = ({ className }: { className?: string }) => (
    <span className={cn("pointer-events-none flex h-lh shrink-0 items-center", className)} aria-label={_("Unread")}>
        <span className="size-1.5 rounded-full bg-surface-blue-6" />
    </span>
)
