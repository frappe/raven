import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useIsMobile } from "@hooks/use-mobile"

/** A hover label for an icon button; touch has no hover, so mobile renders the button alone. */
export const DesktopTooltip = ({ label, children }: { label: string; children: ReactNode }) => {
    const isMobile = useIsMobile()
    if (isMobile) return children
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    )
}
