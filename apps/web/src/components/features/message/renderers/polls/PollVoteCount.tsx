import React from "react"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import { formatVoteCountWithPercentage } from "./pollUtils"

export interface PollVoteCountProps {
    votes: number
    percentage: number
    voters?: { name: string; full_name: string; user_image?: string }[]
    showAvatars?: boolean
    className?: string
}

/**
 * Shared component for displaying vote counts, percentages, and voter avatars.
 * Used in voting components and poll results.
 */
export const PollVoteCount: React.FC<PollVoteCountProps> = ({
    votes,
    percentage,
    voters,
    showAvatars = true,
    className,
}) => {
    if (votes === undefined || votes === null) return null

    return (
        <div className={`flex items-center gap-2 shrink-0 ${className || ""}`}>
            <span className="text-xs text-ink-gray-4 font-medium">
                {formatVoteCountWithPercentage(votes, percentage)}
            </span>
            {showAvatars && voters && voters.length > 0 && (
                <GroupedAvatars users={voters} max={5} size="xs" borderColorClass="border-surface-base" />
            )}
        </div>
    )
}

