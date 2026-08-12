import React from "react"
import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group"
import { cn } from "@lib/utils"
import type { RavenPoll } from "@raven/types/RavenMessaging/RavenPoll"
import type { RavenPollOption } from "@raven/types/RavenMessaging/RavenPollOption"
import { PollVoteCount, getOptionPercentage, getPollStatus } from "./poll-components"
import type { PollOptionWithVoters } from "./poll-components"
import _ from "@lib/translate"

export interface SingleChoicePollVotingProps {
    poll: RavenPoll
    options: (RavenPollOption & { voters?: { id: string; name: string; image: string }[] })[]
    className?: string
    onOptionSelect?: (option: RavenPollOption) => void
}

export const SingleChoicePollVoting: React.FC<SingleChoicePollVotingProps> = ({
    poll,
    options,
    className,
    onOptionSelect,
}) => {
    const isDisabled = poll.is_disabled === 1

    const handleValueChange = (value: string) => {
        if (!isDisabled && onOptionSelect) {
            const selectedOption = options.find((opt) => opt.name === value)
            if (selectedOption) {
                onOptionSelect(selectedOption)
            }
        }
    }

    const { isAnonymous } = getPollStatus(poll)
    const totalVotes = poll.total_votes || 0

    return (
        <>
            <RadioGroup
                disabled={isDisabled}
                onValueChange={handleValueChange}
                className={cn("flex flex-col gap-3", className)}
            >
                {options.map((option) => {
                    const percentage = getOptionPercentage(option, poll)
                    const optionWithVoters = option as PollOptionWithVoters

                    return (
                        <label
                            key={option.name}
                            title={option.option}
                            className={cn(
                                "flex items-center gap-2 px-3.5 bg-surface-gray-1 py-1.5 rounded-full [corner-shape:squircle] w-full cursor-pointer transition-colors",
                                !isDisabled && "hover:bg-surface-gray-3"
                            )}
                        >
                            <RadioGroupItem
                                value={option.name}
                                disabled={isDisabled}
                                className="shrink-0 text-ellipsis"
                            />
                            <span className="text-sm truncate text-ink-gray-7 leading-snug wrap-break-word flex-1 min-w-0">
                                {option.option}
                            </span>
                            {!isAnonymous && totalVotes > 0 && (
                                <PollVoteCount
                                    votes={option.votes || 0}
                                    percentage={percentage}
                                    voters={optionWithVoters.voters}
                                />
                            )}
                        </label>
                    )
                })}
            </RadioGroup>
            <span className="pt-2.5 block px-1 text-sm text-ink-gray-6">{poll.total_votes === 1 ? _("1 vote") : _("{0} votes", [String(poll.total_votes ?? 0)])}</span>
        </>
    )
}

