import React from "react"
import { CheckCircle } from "lucide-react"
import { cn } from "@lib/utils"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import type { RavenPollOption } from "@raven/types/RavenMessaging/RavenPollOption"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import _ from "@lib/translate"
import { Separator } from "@components/ui/separator"

export interface PollOptionWithVoters extends RavenPollOption {
    voters?: { name: string; full_name: string; user_image?: string }[]
}

export interface PollOptionBarProps {
    option: PollOptionWithVoters
    percentage: number
    isCurrentUserVote: boolean
    showVoters?: boolean
}

/**
 * Shared component for displaying poll option results with progress bar, vote counts, and voter avatars.
 * Used in PollMessage, PollDrawer, and SearchResultsPolls.
 */
export const PollOptionBar: React.FC<PollOptionBarProps> = ({
    option,
    percentage,
    isCurrentUserVote,
    showVoters = true,
}) => {

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className={cn(
                        "relative flex h-7 items-center rounded-full [corner-shape:squircle] overflow-hidden group"
                    )}
                >
                    <div className={cn("absolute top-0 left-0 h-full w-full transition-all duration-300 ease-in-out", isCurrentUserVote ? "bg-surface-violet-1 dark:bg-surface-gray-2" : "bg-surface-gray-2")} />
                    <div
                        className={cn(
                            "absolute top-0 left-0 h-full transition-all duration-300 ease-in-out",
                            isCurrentUserVote ? "bg-surface-violet-4" : "bg-surface-gray-4"
                        )}
                        style={{ width: `${percentage}%` }}
                    />
                    <div className="relative z-10 text-ellipsis overflow-hidden flex items-center flex-1 px-3.5 py-1.5 gap-2">
                        <span
                            className={cn(
                                "truncate text-sm leading-snug",
                                isCurrentUserVote ? "text-ink-gray-9 text-sm-medium" : "text-ink-gray-7"
                            )}
                        >
                            {option.option}
                        </span>
                        {isCurrentUserVote && <CheckCircle className="size-3 text-ink-gray-9" />}
                    </div>
                    <div className="relative z-10 flex items-center gap-3 pr-4">
                        {option.votes !== undefined && (
                            <span className="text-xs-medium text-ink-gray-6 flex items-center gap-1">
                                <span>
                                    {option.votes === 1 ? _("1 vote") : _("{0} votes", [String(option.votes)])}
                                </span>
                                <span className="sm:block hidden">•</span>
                                <span className="tabular-nums sm:block hidden">{percentage.toFixed(0)}%</span>
                            </span>
                        )}
                        {showVoters && option.voters && option.voters.length > 0 && (
                            <GroupedAvatars users={option.voters} max={4} size="xs" borderColorClass="border-surface-base" />
                        )}
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <span className="flex items-center gap-2 text-p-sm">
                    {option.option}
                    <Separator orientation="vertical" className="bg-surface-gray-8 h-3!" />
                    <span className="flex gap-1">
                        <span>{option.votes === 1 ? _("1 vote") : _("{0} votes", [String(option.votes)])}</span>
                        <span>•</span>
                        <span className="tabular-nums">{percentage.toFixed(0)}%</span>
                    </span>
                </span>

            </TooltipContent>
        </Tooltip>

    )
}

