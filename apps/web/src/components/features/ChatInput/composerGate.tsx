import { useCallback, useMemo, useSyncExternalStore } from "react"
import { Button } from "@components/ui/button"
import { useChannelById } from "@stores/channels/useChannelList"
import { channelStore } from "@stores/channels/store"
import { useChannelMembers } from "@hooks/useChannelMembers"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useJoinChannel } from "@hooks/useJoinChannel"
import { useUser } from "@hooks/useUser"
import type { DMChannelListItem } from "@raven/types/common/ChannelListItem"
import _ from "@lib/translate"
import { errorResponseToast } from "@components/ui/error-banner"
import { cn } from "@lib/utils"

export type ComposerGateState = "loading" | "composer" | "archived" | "not-member" | "peer-disabled"

/**
 * The gate decision on its own, so it can be tested without React. Order matters:
 * a DM with a disabled peer is blocked even though you're always a member of it.
 */
export const resolveComposerGateState = (facts: {
    channelsLoaded: boolean
    isDM: boolean
    membersLoading: boolean
    isArchived: boolean
    isOpen: boolean
    isMember: boolean
    peerDisabled: boolean
}): ComposerGateState => {
    if (!facts.channelsLoaded || (!facts.isDM && facts.membersLoading)) return "loading"
    if (facts.isArchived) return "archived"
    if (facts.peerDisabled) return "peer-disabled"
    if (facts.isOpen || facts.isMember) return "composer"
    return "not-member"
}

/**
 * Decides what to show where the composer goes, for a channel, DM, or thread (a thread is a
 * channel too). Membership comes from useChannelMembers (store-backed — works for any channel
 * you can view, unlike the channel store which only lists channels you're IN). Rules:
 *  - while the channel list / members are still loading → `loading` (caller shows a skeleton,
 *    so a refresh doesn't flash the composer then the banner)
 *  - archived channel → `archived`
 *  - DM whose peer is a disabled user → `peer-disabled` (client-side only: the server
 *    doesn't check this on the send hot path, and a stray API message does no harm)
 *  - Open channel (not archived) → `composer`, even if you're not a member yet (posting joins)
 *  - otherwise not a member → `not-member` (caller shows a Join button — unless
 *    `canJoin` is false, see below)
 *  - else → `composer`
 * DMs short-circuit to member (you're always in your DM; skip the member fetch).
 *
 * THREADS (`isThread` + `parentChannelID`): joining a thread requires membership
 * of its PARENT channel. A non-member of a public channel can VIEW its threads
 * but not join them — `canJoin` comes back false and the banner renders without
 * its Join button (view only).
 */
export const useComposerGate = (
    channelID: string,
    options?: {
        /** This gate is for a thread — join eligibility depends on the parent. */
        isThread?: boolean
        /** The thread's parent channel (membership there is what allows joining). */
        parentChannelID?: string
    },
) => {
    const { name: currentUser } = useUserCookieData()
    const channel = useChannelById(channelID)
    const channelsLoaded = useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)

    // member_id on the parent's channel-list entry is only set when the current
    // user is a member. An unknown parent (cold deep link still resolving) counts
    // as not-joinable until it resolves.
    const parentChannel = useChannelById(options?.parentChannelID ?? "")
    const canJoin = options?.isThread ? Boolean(parentChannel?.member_id) : true

    const isDM = channel?.is_direct_message === 1
    const isOpen = channel?.type === "Open"
    const isArchived = channel?.is_archived === 1

    const { memberIds, isLoading: membersLoading } = useChannelMembers(channelID, { autoFetch: !isDM })
    // Membership comes from the raw ids, not the resolved member list. The
    // resolved list drops members whose user records haven't loaded yet, so on
    // a refresh it could briefly miss the current user — flashing the
    // "not a member" banner before the composer.
    // member_id on the channel-list entry answers before the roster fetch lands.
    const isMember = isDM || memberIds.includes(currentUser) || Boolean(channel?.member_id)

    // The DM sidebar already hides disabled peers, but the DM stays reachable by URL,
    // from a mention hover card or the command menu.
    const peer = useUser(isDM ? (channel as DMChannelListItem).peer_user_id : undefined)
    const peerDisabled = isDM && peer?.enabled === 0

    // useJoinChannel updates the member store itself (including the roster
    // refresh), so the banner flips as soon as the join succeeds. Nothing
    // more to do here.
    const { joinChannel, loading: joining } = useJoinChannel(channelID)
    const onJoin = useCallback(() => {
        joinChannel().catch((e) => errorResponseToast(_("Could not join"), e))
    }, [joinChannel])

    // A known member_id means we already know the answer. Don't wait for the roster.
    const state = resolveComposerGateState({
        channelsLoaded,
        isDM,
        membersLoading: membersLoading && !channel?.member_id,
        isArchived,
        isOpen,
        isMember,
        peerDisabled,
    })

    return { state, onJoin, joining, canJoin }
}

export type ComposerGate = ReturnType<typeof useComposerGate>

/** Placeholder while we work out whether you can post — keeps the refresh from flashing.
 * Exported for the page skeletons, so their composer matches this one when it swaps in. */
export const ComposerSkeleton = () => (
    <div className="md:px-3 md:pb-3 w-full">
        <div className={cn("md:h-[98px] h-14 standalone:h-20",
            "w-full animate-pulse md:rounded-lg rounded-none md:border border-t border-outline-gray-2 bg-surface-gray-1")} />
    </div>
)

type BlockedState = Exclude<ComposerGateState, "loading" | "composer">

const blockedMessage = (state: BlockedState, isThread: boolean) => {
    if (state === "archived") {
        return isThread
            ? _("This thread is archived. You can't send new messages.")
            : _("This channel is archived. You can't send new messages.")
    }
    if (state === "peer-disabled") {
        return _("This user has been deactivated. You can't send them messages.")
    }
    return isThread ? _("You're not a member of this thread.") : _("You're not a member of this channel.")
}

/** Shown in place of the composer when you can't post — archived, disabled peer, or not a member (with Join). */
const ComposerBlockedBanner = ({
    state,
    onJoin,
    joining,
    isThread = false,
}: {
    state: BlockedState
    onJoin?: () => void
    joining?: boolean,
    isThread?: boolean
}) => {
    const message = useMemo(() => blockedMessage(state, isThread), [state, isThread])

    return <div className="md:px-3 md:pb-3 w-full">
        {/* max(inset, 1rem): Android Chrome reports a 0 safe-area inset (unlike
            iOS's 34px), which left this flush against the screen bottom. */}
        <div className="flex md:min-h-[98px] flex-col items-center justify-center gap-2 md:rounded-lg rounded-none md:border border-t border-outline-gray-2 bg-surface-gray-1 md:px-3 px-4 py-4 standalone:pb-[max(var(--inset-bottom),1rem)] text-sm text-ink-gray-6">
            <span className="text-p-base text-center">
                {message}
            </span>
            {state === "not-member" && onJoin && (
                <Button size="sm" loading={joining} variant="outline" loadingText={_("Joining…")} onClick={onJoin}>
                    {_("Join")}
                </Button>
            )}
        </div>
    </div>
}

/** Renders the composer (`children`) or, per the gate, a skeleton / blocked banner. */
export const ComposerArea = ({ gate, children, isThread = false }: { gate: ComposerGate; children: React.ReactNode; isThread?: boolean }) => {
    if (gate.state === "loading") return <ComposerSkeleton />
    if (gate.state === "archived" || gate.state === "peer-disabled") {
        return <ComposerBlockedBanner state={gate.state} isThread={isThread} />
    }
    if (gate.state === "not-member") {
        // No Join button when joining isn't possible (a thread whose parent channel
        // the user isn't a member of) — the banner alone says "view only".
        return <ComposerBlockedBanner state="not-member" onJoin={gate.canJoin ? gate.onJoin : undefined} joining={gate.joining} isThread={isThread} />
    }
    return <>{children}</>
}
