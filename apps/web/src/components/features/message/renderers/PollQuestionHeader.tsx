import React from "react"
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

    const formatEndDate = () => {
        if (!poll.end_date) return null
        try {
            return getDateObject(poll.end_date).format(timeFormat === "12-hour" ? "MMM D, YYYY, h:mma" : "MMM D, YYYY, HH:mm")
        } catch {
            return "a future date"
        }
    }

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
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
            {poll.end_date && !isDisabled && formatEndDate() && (
                <span className="text-xs text-ink-gray-4/80">
                    This poll will end on {formatEndDate()}.
                </span>
            )}
        </div>
    )
}

