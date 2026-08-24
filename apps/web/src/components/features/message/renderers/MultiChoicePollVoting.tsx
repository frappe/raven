import React from "react"
import { Checkbox } from "@components/ui/checkbox"
import { Button } from "@components/ui/button"
import { cn } from "@lib/utils"
import type { RavenPoll } from "@raven/types/RavenMessaging/RavenPoll"
import type { RavenPollOption } from "@raven/types/RavenMessaging/RavenPollOption"
import { PollVoteCount, getOptionPercentage, getPollStatus } from "./poll-components"
import type { PollOptionWithVoters } from "./poll-components"
import _ from "@lib/translate"

export interface MultiChoicePollVotingProps {
    poll: RavenPoll
    options: (RavenPollOption & { voters?: { id: string; name: string; image: string }[] })[]
    className?: string
    onOptionToggle?: (optionId: string, checked: boolean) => void
    onSubmit?: (selectedOptionIds: string[]) => void
}

export const MultiChoicePollVoting: React.FC<MultiChoicePollVotingProps> = ({
    poll,
    options,
    className,
    onOptionToggle,
    onSubmit,
}) => {
    const [selectedOptions, setSelectedOptions] = React.useState<string[]>([])

    // Two SEPARATE things, deliberately not one flag: a closed poll disables
    // everything, but a full selection (max choices reached) only blocks adding
    // MORE options — unchecking and submitting must keep working, otherwise a
    // full selection locks the voter out of the poll entirely.
    const pollClosed = poll.is_disabled === 1
    const maxChoices = poll.max_choices || 0
    const maxReached = maxChoices > 0 && selectedOptions.length >= maxChoices

    const handleCheckboxChange = (optionId: string, checked: boolean) => {
        if (pollClosed) return
        // At the cap only ADDING is blocked; unchecking is always allowed.
        if (checked && maxReached) return

        setSelectedOptions((prev) => {
            if (checked) {
                return [...prev, optionId]
            } else {
                return prev.filter((id) => id !== optionId)
            }
        })

        if (onOptionToggle) {
            onOptionToggle(optionId, checked)
        }
    }

    const handleSubmit = () => {
        if (!pollClosed && selectedOptions.length > 0 && onSubmit) {
            onSubmit(selectedOptions)
        }
    }

    const { isAnonymous } = getPollStatus(poll)
    const totalVotes = poll.total_votes || 0

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <div className="flex flex-col gap-3">
                {options.map((option) => {
                    const percentage = getOptionPercentage(option, poll)
                    const isChecked = selectedOptions.includes(option.name)
                    const optionWithVoters = option as PollOptionWithVoters
                    // A CHECKED option stays enabled at the cap — it can be unchecked.
                    const optionDisabled = pollClosed || (maxReached && !isChecked)

                    return (
                        <label
                            key={option.name}
                            title={option.option}
                            data-checked={isChecked}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 h-7 w-full bg-surface-gray-1 data-[checked=true]:bg-surface-gray-2 rounded-full [corner-shape:squircle] cursor-pointer transition-colors",
                                !optionDisabled && "hover:bg-surface-gray-2"
                            )}
                        >
                            <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                    handleCheckboxChange(option.name, checked === true)
                                }
                                disabled={optionDisabled}
                                className="shrink-0"
                            />
                            <span className="text-sm text-ink-gray-8 wrap-break-word flex-1 min-w-0 leading-snug">
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
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
                <div>
                    {isAnonymous
                        ? <span className="text-p-xs text-ink-gray-4 px-2">{_("Please submit your choice(s) to view the results.")} </span>
                        : null}
                </div>
                <div>
                    {!pollClosed && selectedOptions.length > 0 && (
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={selectedOptions.length === 0}
                        >
                            {_("Submit")}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

