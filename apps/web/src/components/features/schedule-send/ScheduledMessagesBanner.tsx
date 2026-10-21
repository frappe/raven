import { useAtomValue, useSetAtom } from "jotai"
import { useNavigate } from "react-router-dom"
import { CalendarClockIcon, CircleAlertIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { useIsMobile } from "@hooks/use-mobile"
import { timeFormatAtom } from "@utils/preferences"
import { formatDateTimeLabel, fromServerDatetime } from "@lib/timeUtils"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { scheduledMessagesDialogOpenAtom, useChannelScheduledMessages } from "./useScheduledMessages"

/**
 * Heads-up above the composer when this channel has messages scheduled for later,
 * so nobody sends the same thing twice or wonders whether it went out. Same idiom as
 * the quiet hours banner. View opens the scheduled messages dialog on desktop and
 * the scheduled messages page on mobile. Not rendered for thread composers, which
 * cannot schedule.
 */
export const ScheduledMessagesBanner = ({ channelID }: { channelID: string }) => {
    const rows = useChannelScheduledMessages(channelID)
    const timeFormat = useAtomValue(timeFormatAtom)
    const setDialogOpen = useSetAtom(scheduledMessagesDialogOpenAtom)
    const navigate = useNavigate()
    const isMobile = useIsMobile()

    if (rows.length === 0) return null

    // A failed delivery matters more than the next pending one, so it takes the line.
    const failed = rows.filter((row) => row.status === "Failed").length
    const next = rows.find((row) => row.status === "Scheduled")
    const text = failed > 0
        ? (failed === 1 ? _("A scheduled message failed to send.") : _("{0} scheduled messages failed to send.", [String(failed)]))
        : rows.length === 1 && next
            ? _("Message scheduled for {0}.", [formatDateTimeLabel(fromServerDatetime(next.scheduled_time), timeFormat)])
            : next
                ? _("{0} messages scheduled, next on {1}.", [String(rows.length), formatDateTimeLabel(fromServerDatetime(next.scheduled_time), timeFormat)])
                : _("{0} messages scheduled.", [String(rows.length)])

    const view = () => {
        if (isMobile) navigate("/scheduled-messages")
        else setDialogOpen(true)
    }

    return (
        <div className="flex items-center gap-1.5 rounded-md bg-surface-gray-2 dark:bg-surface-elevation-2 py-1 pl-3 pr-1 md:mx-0 mx-1">
            <span className="flex h-lh shrink-0 items-center" aria-hidden="true">
                {failed > 0
                    ? <CircleAlertIcon className="size-4 text-ink-red-5" />
                    : <CalendarClockIcon className="size-4 text-ink-gray-6" />}
            </span>
            <span className={cn("flex-1 text-p-xs", failed > 0 ? "text-ink-red-5" : "text-ink-gray-7")}>{text}</span>
            <Button type="button" variant="ghost" size="sm" onClick={view}>
                {_("View")}
            </Button>
        </div>
    )
}
