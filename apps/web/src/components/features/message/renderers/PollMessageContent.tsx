import { useMemo } from "react"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import type { Message } from "@raven/types/common/Message"
import type { RavenPoll } from "@raven/types/RavenMessaging/RavenPoll"
import type { RavenPollOption } from "@raven/types/RavenMessaging/RavenPollOption"
import { useHasBeenInView } from "@hooks/useHasBeenInView"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { useSetAtom } from "jotai"
import { pollDrawerAtom, channelDrawerAtom } from "@utils/channelAtoms"
import { useCanInteractInChannel } from "@stores/channels/useChannelList"
import _ from "@lib/translate"
import { PollVotingContainer } from "./PollVotingContainer"
import { PollQuestionHeader } from "./PollQuestionHeader"
import { SingleChoicePollVoting } from "./SingleChoicePollVoting"
import { MultiChoicePollVoting } from "./MultiChoicePollVoting"
import { PollOptionBar, getOptionPercentage, isUserVote, type PollOptionWithVoters } from "./poll-components"
import { TooltipProvider } from "@components/ui/tooltip"
import { errorResponseToast } from "@components/ui/error-banner"

export type PollData = {
    poll: RavenPoll & { options: RavenPollOption[] }
    current_user_votes: { option: string; name: string }[]
    /** option id → voter user ids (non-anonymous polls only; empty for anonymous). */
    votes: Record<string, string[]>
}

/**
 * Parse the question + option texts straight from the poll message's `content`
 * (`question\n1. opt\n2. opt`, written by create_poll). Lets us render a full poll
 * skeleton with NO fetch — only the live data (option ids, vote counts, your vote,
 * the multi/anon/closed flags) needs get_poll.
 */
const parsePollContent = (content?: string | null) => {
    const lines = (content ?? "").split("\n").map((l) => l.trim()).filter(Boolean)
    return { question: lines[0] ?? "", options: lines.slice(1).map((l) => l.replace(/^\d+\.\s*/, "")) }
}

/**
 * A poll in the message stream. Content-only (the avatar/name/time come from the
 * message row). Renders a content-derived skeleton until the row scrolls into view,
 * then fetches the poll's live data — so a polls channel only fetches the polls the
 * user actually sees, not every windowed message.
 */
export const PollMessageContent = ({ message }: { message: Message }) => {
    const { ref, hasBeenInView } = useHasBeenInView()
    return (
        <div ref={ref}>
            {hasBeenInView ? <LoadedPoll message={message} /> : <PollSkeleton content={message.content} />}
        </div>
    )
}

const PollSkeleton = ({ content }: { content?: string | null }) => {
    const { question, options } = useMemo(() => parsePollContent(content), [content])
    return (
        <PollVotingContainer>
            <span className="block text-p-base-medium text-ink-gray-7 max-w-md min-w-0">{question}</span>
            <div className="flex flex-col gap-3">
                {options.map((option, i) => (
                    <div key={i} className="flex items-center gap-2 h-7 bg-surface-gray-1 truncate animate-pulse max-w-full rounded-full [corner-shape:squircle] text-sm">
                        <span className="min-w-0 flex-1 wrap-break-word h-7 px-3.5 py-1.5 text-ink-gray-7 pr-[calc(12ch+14px)] leading-snug">{option}</span>
                    </div>
                ))}
            </div>
            <span className="px-1 text-sm text-ink-gray-4">Loading...</span>
        </PollVotingContainer>
    )
}

const LoadedPoll = ({ message }: { message: Message }) => {
    // Only mounted once the row is in view, so the fetch fires lazily.
    const { data, isLoading, mutate } = useFrappeGetCall<{ message: PollData }>(
        "raven.api.raven_poll.get_poll",
        { message_id: message.name },
        ["poll", message.name],
        { dedupingInterval: 10000, focusThrottleInterval: 5000 },
    )
    const { call: addVote } = useFrappePostCall("raven.api.raven_poll.add_vote")
    const usersById = useUsersById()
    const setPollDrawer = useSetAtom(pollDrawerAtom(message.channel_id))
    const setChannelDrawer = useSetAtom(channelDrawerAtom(message.channel_id))
    // Boolean-snapshot hook, NOT useChannelById: the channel object's identity
    // changes on every incoming message, and every poll card in view would
    // re-render along with it. The boolean flips only on join/leave/type change.
    const canVote = useCanInteractInChannel(message.channel_id)

    // Live poll updates (vote / retract / close) are handled by a single app-level listener
    // (usePollRealtime) that revalidates this poll's `["poll", message.name]` cache by key —
    // no per-poll listener here.

    // Show the same skeleton while the live data loads — height-stable, no flash.
    if (isLoading || !data) return <PollSkeleton content={message.content} />

    const { poll, current_user_votes, votes } = data.message
    const hasVoted = current_user_votes.length > 0

    // Non-members still SEE the poll, as the read-only results card: hiding
    // results until you vote only makes sense for someone who CAN vote.
    // (Membership semantics — Open/member_id/threads — live on the hook.)

    // Resolve each option's voter ids → user objects (names/avatars) from the user store.
    // Empty for anonymous polls (the backend doesn't send voters for those).
    const votersFor = (optionId: string) =>
        (votes[optionId] ?? []).map((id) => usersById.get(id)).filter((u) => u !== undefined)

    // Clicking the poll opens the detail drawer (full voter lists, status, retract).
    // Hosting is in ChatContentView via pollDrawerAtom. IDENTITY only: the drawer
    // reads the same ["poll", id] SWR cache this card just loaded, so it opens
    // instantly AND stays live — a data snapshot here went stale mid-view.
    const openPollDrawer = () => {
        // Single rail slot — opening the poll dismisses any open context drawer (a thread
        // route stays underneath and returns when the poll closes).
        setChannelDrawer("")
        setPollDrawer({ messageID: message.name })
    }
    const showResults = hasVoted || poll.is_disabled === 1 || !canVote

    const submitVote = (optionIds: string[]) => {
        if (optionIds.length === 0 || !canVote) return
        addVote({ message_id: message.name, option_id: poll.is_multi_choice ? optionIds : optionIds[0] })
            .then(() => mutate())
            .catch((e) => errorResponseToast(_("Could not record your vote"), e))
    }

    return (
        <PollVotingContainer>
            {showResults ? (
                // Results are read-only — the WHOLE card (question + options + count) opens
                // the detail drawer. Not in voting mode: that would reveal results the inline
                // card deliberately hides until you vote.
                <TooltipProvider>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={openPollDrawer}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                openPollDrawer()
                            }
                        }}
                        className="flex w-full cursor-pointer flex-col gap-3 rounded-md focus-visible:outline-none"
                        title={_("View poll details")}
                    >
                        <PollQuestionHeader poll={poll} />
                        {poll.options.map((option) => (
                            <PollOptionBar
                                key={option.name}
                                option={{ ...option, voters: votersFor(option.name) } as PollOptionWithVoters}
                                showVoters={!poll.is_anonymous}
                                percentage={getOptionPercentage(option, poll)}
                                isCurrentUserVote={isUserVote(option.name, current_user_votes)}
                            />
                        ))}
                        <span className="px-1 text-sm text-ink-gray-6">{_("{0} votes", [String(poll.total_votes ?? 0)])}</span>
                    </div>
                </TooltipProvider>
            ) : (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={openPollDrawer}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            openPollDrawer()
                        }
                    }}
                    className="flex w-full cursor-pointer flex-col gap-3 rounded-md focus-visible:outline-none"
                    title={_("View poll details")}
                >
                    <PollQuestionHeader poll={poll} />
                    {/* The voting controls sit inside the drawer-opening card, so their
                        clicks (and Enter/Space presses) bubble up to the wrapper above —
                        casting a vote would ALSO open the poll drawer. Stop both here.
                        The question header stays clickable as the drawer target. */}
                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        {poll.is_multi_choice === 1 ? (
                            <MultiChoicePollVoting poll={poll} options={poll.options} onSubmit={submitVote} />
                        ) : (
                            <SingleChoicePollVoting poll={poll} options={poll.options} onOptionSelect={(option) => submitVote([option.name])} />
                        )}
                    </div>
                </div>
            )}
        </PollVotingContainer>
    )
}
