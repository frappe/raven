import { MapPin } from "lucide-react"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"
import { DesktopTooltip } from "../DesktopTooltip"

/** Composer toolbar button that opens the location picker. */
export const ShareLocationButton = ({ onClick }: { onClick: () => void }) => (
    <DesktopTooltip label={_("Share location")}>
        <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("Share location")} onClick={onClick}>
            <MapPin />
        </Button>
    </DesktopTooltip>
)
