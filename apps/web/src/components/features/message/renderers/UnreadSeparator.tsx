import { Badge } from "@components/ui/badge"
import { Separator } from "@components/ui/separator"
import _ from "@lib/translate"

/**
 * The "New messages" divider — a non-sticky accent line marking where unread messages begin
 * (the member's last_visit at channel entry). `data-unread-divider` lets the scroll engine
 * find it to land the user here on open.
 */
export default function UnreadSeparator() {
    return (
        // data-unread-divider is REQUIRED — the scroll engine queries it to land here on entry.
        // No z-index: it's a plain inline row. (It used to carry one from its sticky
        // days — which made it paint straight through the mobile thread layer.)
        <div
            data-unread-divider
            className="py-2 -mx-8 px-8 flex items-center bg-surface-base"
        >
            <Separator className="flex-1 bg-surface-blue-2" />
            <Badge variant="subtle" theme="blue" size='md'>{_("New messages")}</Badge>
            <Separator className="flex-1 bg-surface-blue-2" />
        </div>
    )
}
