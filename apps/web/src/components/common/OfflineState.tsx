import { WifiOff } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import _ from "@lib/translate"

/** Full-panel state for a load that failed offline: no retry, the view refetches itself on reconnect. */
export const OfflineState = () => (
    <Empty>
        <EmptyHeader>
            <EmptyMedia>
                <WifiOff className="size-6 text-ink-gray-5" />
            </EmptyMedia>
            <EmptyTitle>{_("You're offline")}</EmptyTitle>
            <EmptyDescription>{_("This will load when you're back online.")}</EmptyDescription>
        </EmptyHeader>
    </Empty>
)
