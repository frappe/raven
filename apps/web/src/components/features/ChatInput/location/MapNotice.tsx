import { Button } from "@components/ui/button"
import { Spinner } from "@components/ui/spinner"
import _ from "@lib/translate"

type MapNoticeProps = {
    message: string
    isMobile: boolean
    spinner?: boolean
    onRetry?: () => void
}

/** A centred status panel for the map area: loading, denied, or failed. */
export const MapNotice = ({ message, isMobile, spinner, onRetry }: MapNoticeProps) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface-gray-2 px-6 text-center">
        {spinner && <Spinner size="lg" />}
        <p className="text-base text-ink-gray-7 md:text-sm">{message}</p>
        {onRetry && (
            <Button variant="outline" size={isMobile ? "lg" : "md"} onClick={onRetry}>
                {_("Retry")}
            </Button>
        )}
    </div>
)
