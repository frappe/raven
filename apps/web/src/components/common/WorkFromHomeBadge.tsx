import { House } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { useIsUserWorkingFromHome } from "@hooks/useIsUserWorkingFromHome"
import _ from "@lib/translate"

/** "Working from home" pill, placed next to OnLeaveBadge. Renders nothing unless the user is working from home today. */
export const WorkFromHomeBadge = ({ userID, size = "md", className }: { userID: string; size?: "sm" | "md" | "lg"; className?: string }) => {
    const isWorkingFromHome = useIsUserWorkingFromHome(userID)
    if (!isWorkingFromHome) return null

    return (
        <Badge variant="subtle" theme="blue" size={size} className={className}>
            <House />
            {_("Working from home")}
        </Badge>
    )
}
