import { X } from "lucide-react"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"

interface UnreadFilterPillProps {
    active: boolean
    onToggle: (next: boolean) => void
}

/**
 * Slack-style floating "Unread" filter pill for mobile/PWA (`md:hidden` — desktop uses
 * the header toggle instead). Off = outline pill you tap to enable; on = solid pill with
 * an ✕ affordance to clear. Sits just above the mobile footer — bottom offset = footer
 * height (2rem) + home-indicator inset + a small gap. Shared by Threads and Notifications;
 * parent pane must be `relative`.
 */
export const UnreadFilterPill = ({ active, onToggle }: UnreadFilterPillProps) => (
    <Button
        variant={active ? "solid" : "outline"}
        size="lg"
        aria-pressed={active}
        onClick={() => onToggle(!active)}
        className="absolute right-4 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-10 rounded-full shadow-lg md:hidden"
    >
        {_("Unread")}
        {active && <X />}
    </Button>
)
