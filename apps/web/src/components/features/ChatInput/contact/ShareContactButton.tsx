import { UserRound } from "lucide-react"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"
import { DesktopTooltip } from "../DesktopTooltip"

/** Composer toolbar button that opens the contact picker. */
export const ShareContactButton = ({ onClick }: { onClick: () => void }) => (
    <DesktopTooltip label={_("Share contact")}>
        <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("Share contact")} onClick={onClick}>
            <UserRound />
        </Button>
    </DesktopTooltip>
)
