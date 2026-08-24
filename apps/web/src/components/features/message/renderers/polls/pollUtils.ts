import type { RavenPoll } from "@raven/types/RavenMessaging/RavenPoll"
import type { RavenPollOption } from "@raven/types/RavenMessaging/RavenPollOption"

/**
 * Calculate the percentage of votes for an option
 */
export const calculatePercentage = (optionVotes: number, totalVotes: number): number => {
    if (totalVotes === 0) return 0
    return (optionVotes / totalVotes) * 100
}

/**
 * Format vote count with proper pluralization
 */
export const formatVoteCount = (count: number): string => {
    return `${count} vote${count === 1 ? "" : "s"}`
}

/**
 * Format vote count with percentage
 */
export const formatVoteCountWithPercentage = (count: number, percentage: number): string => {
    return `${formatVoteCount(count)} • ${percentage.toFixed(0)}%`
}

/**
 * Check if user has voted for a specific option
 */
export const isUserVote = (
    optionName: string,
    currentUserVotes: Array<{ option: string }>
): boolean => {
    return currentUserVotes.some((vote) => vote.option === optionName)
}

/**
 * Get poll status flags
 */
export const getPollStatus = (poll: RavenPoll) => {
    return {
        isAnonymous: poll.is_anonymous === 1,
        isDisabled: poll.is_disabled === 1,
        isMultiChoice: poll.is_multi_choice === 1,
    }
}

/**
 * Calculate percentage for a poll option
 */
export const getOptionPercentage = (
    option: RavenPollOption,
    poll: RavenPoll
): number => {
    const totalVotes = poll.total_votes || 0
    const optionVotes = option.votes || 0
    return calculatePercentage(optionVotes, totalVotes)
}

