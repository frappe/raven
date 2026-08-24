import React from "react"
import dayjs from "dayjs"
import { Badge } from "@components/ui/badge"
import { cn } from "@lib/utils"
import type { RavenPoll } from "@raven/types/RavenMessaging/RavenPoll"
import { getDateObject } from "@lib/date"
import { HatGlassesIcon, LockIcon } from "lucide-react"
import _ from "@lib/translate"
import { timeFormatAtom } from "@utils/preferences"
import { useAtomValue } from "jotai"

export interface PollQuestionHeaderProps {
    poll: RavenPoll
    className?: string
}

export const PollQuestionHeader: React.FC<PollQuestionHeaderProps> = ({ poll, className }) => {
    const isAnonymous = poll.is_anonymous === 1
    const isDisabled = poll.is_disabled === 1

    const timeFormat = useAtomValue(timeFormatAtom)

    const endText = (() => {
        if (!poll.end_date || isDisabled) return null
        try {
            // getDateObject converts the server timestamp to the viewer's local
            // time, so the today/tomorrow comparisons are in their timezone.
            const end = getDateObject(poll.end_date)
            const time = end.format(timeFormat === "12-hour" ? "h:mma" : "HH:mm")
            // "today/tomorrow at 5pm" instead of a full date the reader has to
            // mentally diff against now — near deadlines are when it matters.
            if (end.isSame(dayjs(), "day")) return _("This poll will end today at {0}.", [time])
            if (end.isSame(dayjs().add(1, "day"), "day")) return _("This poll will end tomorrow at {0}.", [time])
            return _("This poll will end on {0}.", [
                end.format(timeFormat === "12-hour" ? "Do MMM YYYY - h:mma" : "Do MMM YYYY - HH:mm"),
            ])
        } catch {
            return _("This poll will end on a future date.")
        }
    })()

    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <div className="flex items-start justify-between sm:gap-4 gap-2 sm:flex-row flex-col ">
                <span className="text-p-base-medium text-ink-gray-7 flex-1 min-w-0 max-w-md">
                    {poll.question}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    {isAnonymous && (
                        <Badge variant="subtle" theme="violet">
                            <HatGlassesIcon />
                            Anonymous
                        </Badge>
                    )}
                    {isDisabled && (
                        <Badge variant="subtle">
                            <LockIcon />
                            Closed
                        </Badge>
                    )}
                </div>
            </div>
            {endText && (
                <span className="text-p-xs text-ink-gray-5">
                    {endText}
                </span>
            )}
        </div>
    )
}

