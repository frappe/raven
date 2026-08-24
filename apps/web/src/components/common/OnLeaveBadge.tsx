import { TreePalm } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { useIsUserOnLeave } from "@hooks/useIsUserOnLeave"
import _ from "@lib/translate"

/**
 * "On Leave" pill, shown wherever a user is surfaced (mentions, DM header, profile
 * drawer). Self-contained: subscribes to the leave store via useIsUserOnLeave and
 * renders nothing unless the user is on leave today, so callers just drop it in.
 */
export const OnLeaveBadge = ({ userID, size = "md", className }: { userID: string; size?: "sm" | "md" | "lg"; className?: string }) => {
    const isOnLeave = useIsUserOnLeave(userID)
    if (!isOnLeave) return null

    return (
        <Badge variant="subtle" theme="amber" size={size} className={className}>
            <TreePalm />
            {_("On Leave")}
        </Badge>
    )
}
