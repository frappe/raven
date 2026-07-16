import React, { useState } from "react"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { Spinner } from "@components/ui/spinner"
import type { PollData } from "./PollMessageContent"
import { ScrollArea } from "@components/ui/scroll-area"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { X, MoreVertical, CheckCircle, LockIcon, ListChecksIcon, HatGlassesIcon } from "lucide-react"
import { cn } from "@lib/utils"
import { UserAvatar } from "../UserAvatar"
import { getDateObject } from "@lib/date"
import type { UserData } from "@db"
import { getOptionPercentage, getPollStatus, isUserVote } from "./poll-components"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog"
import _ from "@lib/translate"
import { Separator } from "@components/ui/separator"
import { useAtomValue } from "jotai"
import { timeFormatAtom } from "@utils/preferences"
import { errorResponseToast } from "@components/ui/error-banner"

export interface PollDrawerProps {
    /**
     * The poll MESSAGE id — identity only. The drawer subscribes to the same
     * ["poll", id] SWR cache as the inline card, so it opens instantly (the
     * card already warmed the cache) and updates LIVE when usePollRealtime
     * revalidates that key on poll_update events. Receiving poll DATA as a
     * prop froze the drawer at whatever it looked like when opened.
     */
    messageID: string
    onClose: () => void
}

export const PollDrawer: React.FC<PollDrawerProps> = ({ messageID, onClose }) => {
    // Key + options identical to PollMessageContent's fetch — one cache entry,
    // two subscribers, both refreshed by the same realtime mutate.
    const { data } = useFrappeGetCall<{ message: PollData }>(
        "raven.api.raven_poll.get_poll",
        { message_id: messageID },
        ["poll", messageID],
        { dedupingInterval: 10000, focusThrottleInterval: 5000 },
    )
    const usersById = useUsersById()

    // Only the poll's creator can close it.
    const { name: currentUser } = useUserCookieData()

    const { call: retractVote, loading: retracting } = useFrappePostCall("raven.api.raven_poll.retract_vote")
    const [confirmClose, setConfirmClose] = useState(false)
    const { call: closePoll, loading: closing } = useFrappePostCall("raven.api.raven_poll.close_poll")
    const timeFormat = useAtomValue(timeFormatAtom)

    // Rare — the cache is warm whenever the drawer is opened from a poll card
    if (!data) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Spinner />
            </div>
        )
    }

    const { poll: rawPoll, current_user_votes: currentUserVotes, votes } = data.message
    // Resolve each option's voter ids → user objects (empty for anonymous polls,
    // where the backend doesn't send voters)
    const poll = {
        ...rawPoll,
        options: rawPoll.options.map((option) => ({
            ...option,
            voters: (votes[option.name] ?? [])
                .map((id) => usersById.get(id))
                .filter((voter): voter is UserData => voter !== undefined)
                .map((voter) => ({
                    id: voter.name,
                    name: voter.name,
                    full_name: voter.full_name,
                    image: voter.user_image ?? "",
                })),
        })),
    }
    const user = usersById.get(poll.owner)
    const totalVotes = poll.total_votes || 0
    const { isAnonymous, isDisabled: isPollClosed } = getPollStatus(poll)
    const hasVoted = currentUserVotes.length > 0
    const isOwner = poll.owner === currentUser

    // Retract / close: the drawer itself is live (poll_update revalidates the
    // shared cache), closing on success is just the friendlier gesture.
    const onRetract = () => {
        retractVote({ poll_id: poll.name })
            .then(() => onClose())
            .catch((e) => errorResponseToast(_("Could not retract your vote"), e))
    }
    const onClosePoll = () => {
        closePoll({ poll_id: poll.name })
            // Success closes the drawer (which unmounts this dialog); keep it open on error.
            .then(() => onClose())
            .catch((e) => errorResponseToast(_("Could not close the poll"), e))
    }

    // Plain expression, not useMemo: the poll data is LIVE now (a closed poll
    // must flip the badge), and it's cheap.
    const pollStatusBadge: null | { text: string; theme: 'gray' | 'red'; icon?: React.ElementType } = (() => {
        if (!poll.end_date) {
            // If the poll does not have an end date, it is open indefinitely
            return null
        }
        if (isPollClosed) {
            return { text: _("Closed"), theme: "red", icon: LockIcon }
        }
        try {
            const endDateObj = getDateObject(poll.end_date)
            const formattedDate = endDateObj.format(timeFormat === "12-hour" ? "MMM D, h:mma" : "MMM D, HH:mm")
            return { text: _("Open until {0}", [formattedDate]), theme: "gray" }
        } catch {
            return { text: _("Open"), theme: "gray" }
        }
    })()

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 md:border-b h-11 shrink-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <h2 className="text-lg-medium mb-0">Poll</h2>
                    {pollStatusBadge && (
                        <Badge variant="outline" theme={pollStatusBadge.theme}>
                            {pollStatusBadge.icon && <pollStatusBadge.icon />}
                            {pollStatusBadge.text}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                isIconButton
                                aria-label="Poll settings"
                            >
                                <MoreVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                            <DropdownMenuItem
                                disabled={!hasVoted || isPollClosed || retracting}
                                onClick={onRetract}
                            >
                                {_("Retract my vote")}
                            </DropdownMenuItem>
                            {isOwner && (
                                <DropdownMenuItem
                                    variant="destructive"
                                    disabled={isPollClosed}
                                    onSelect={() => setConfirmClose(true)}
                                >
                                    {_("Close poll")}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="ghost"
                        size="sm"
                        isIconButton
                        onClick={onClose}
                        aria-label="Close drawer"
                        className="md:inline-flex hidden"
                    >
                        <X />
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-3">
                    <div className="px-1 space-y-3 pb-4">
                        {/* Poll Question */}
                        <p className="text-p-base-medium text-ink-gray-8">{poll.question}</p>
                        {/* Poll Creator and Creation Time */}
                        <div className="flex items-center gap-2 text-sm text-ink-gray-7">
                            {user && (
                                <UserAvatar
                                    user={user}
                                    size="sm"
                                    showStatusIndicator={false}
                                />
                            )}
                            <span>{user?.full_name || poll.owner}</span>
                            <span className="text-ink-gray-5 text-xs">{getDateObject(poll.creation).format(timeFormat === "12-hour" ? "MMM D, h:mma" : "MMM D, HH:mm")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge>
                                {totalVotes === 1 ? _("1 vote") : _("{0} votes", [String(totalVotes)])}
                            </Badge>
                            {poll.is_multi_choice === 1 &&
                                <Badge variant="subtle" theme="blue">
                                    <ListChecksIcon /> {_("Multiple choice")}
                                </Badge>}
                            {isAnonymous &&
                                <Badge variant="subtle" theme="violet">
                                    <HatGlassesIcon /> {_("Anonymous")}
                                </Badge>}
                        </div>



                        {/* Poll Options */}
                        <div className="space-y-4 pt-1">
                            {poll.options.map((option) => {
                                const percentage = getOptionPercentage(option, poll)
                                const isCurrentUserVote = isUserVote(option.name, currentUserVotes)
                                const optionVotes = option.votes || 0
                                const optionWithVoters = option as typeof option & {
                                    voters?: { id: string; name: string; full_name?: string; image: string }[]
                                }
                                const showVoters = !isAnonymous && optionWithVoters.voters && optionWithVoters.voters.length > 0

                                return (
                                    <div
                                        key={option.name}
                                        className={cn(
                                            "p-3 border rounded-lg",
                                            isCurrentUserVote
                                                ? "border-outline-violet-3 bg-surface-violet-1 dark:border-outline-gray-3 dark:bg-surface-elevation-2"
                                                : "border-outline-gray-1"
                                        )}
                                    >
                                        <div className="space-y-3">
                                            {/* Option Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                    <span
                                                        className={cn(
                                                            "text-p-sm wrap-break-word min-w-0",
                                                            isCurrentUserVote ? "text-ink-gray-8 text-p-sm-medium" : "text-ink-gray-8"
                                                        )}
                                                    >
                                                        {option.option}
                                                    </span>
                                                    {isCurrentUserVote && (
                                                        <CheckCircle className="w-3.5 h-3.5 text-ink-gray-8 shrink-0 mt-0.5" />
                                                    )}
                                                </div>
                                                {/* Added pt-px here because the paragraph has a higher line height than the text-sm font-semibold */}
                                                <div className="flex items-center gap-1.5 shrink-0 pt-px">
                                                    <span className="text-sm font-semibold text-ink-gray-8">
                                                        {optionVotes}
                                                    </span>
                                                    <Separator orientation="vertical" className="bg-surface-gray-4 h-3!" />
                                                    <span className="text-sm text-ink-gray-5 tabular-nums">
                                                        {percentage.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="relative h-2 w-full rounded-full bg-surface-gray-2 overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-500 ease-out",
                                                        isCurrentUserVote ? "bg-surface-gray-10" : "bg-surface-gray-6"
                                                    )}
                                                    style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                                                />
                                            </div>

                                            {/* Voters List */}
                                            {showVoters && (
                                                <div className="pt-2 border-t">
                                                    <div className="space-y-1 max-h-75 overflow-y-auto">
                                                        {optionWithVoters.voters?.map((voter) => (
                                                            <div
                                                                key={voter.id}
                                                                className="flex items-center gap-2 py-0.5"
                                                            >
                                                                <UserAvatar
                                                                    user={{
                                                                        name: voter.name,
                                                                        full_name: voter.full_name || voter.name,
                                                                        user_image: voter.image,
                                                                        type: "User",
                                                                        availability_status: "",
                                                                        custom_status: "",
                                                                        enabled: 1,
                                                                    }}
                                                                    size="xs"
                                                                    showStatusIndicator={false}
                                                                />
                                                                <span className="text-sm text-ink-gray-8">
                                                                    {voter.full_name || voter.name}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {isAnonymous && optionVotes > 0 && (
                                                <div className="text-xs text-ink-gray-6 italic pt-3 border-t">
                                                    {optionVotes} anonymous vote{optionVotes === 1 ? "" : "s"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </ScrollArea>
            </div>

            {/* Closing a poll stops all voting and can't be undone — confirm first. Controlled
                (not a trigger) because the dropdown unmounts its items on close. */}
            <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{_("Close this poll?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {_("No one will be able to vote once it's closed, and this can't be undone.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={closing}>{_("Cancel")}</AlertDialogCancel>
                        <Button type="button" variant="solid" theme="red" size="md" loading={closing} loadingText={_("Closing...")} onClick={onClosePoll}>
                            {_("Close poll")}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
