import { useCallback, useContext, useMemo, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { Button } from "@components/ui/button"
import { useChannelById } from "@stores/channels/useChannelList"
import { channelStore } from "@stores/channels/store"
import { useChannelMembers, loadChannelMembers } from "@hooks/useChannelMembers"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useJoinChannel } from "@hooks/useJoinChannel"
import _ from "@lib/translate"
import { errorResponseToast } from "@components/ui/error-banner"
import { cn } from "@lib/utils"

export type ComposerGateState = "loading" | "composer" | "archived" | "not-member"

/**
 * Decides what to show where the composer goes, for a channel, DM, or thread (a thread is a
 * channel too). Membership comes from useChannelMembers (store-backed — works for any channel
 * you can view, unlike the channel store which only lists channels you're IN). Rules:
 *  - while the channel list / members are still loading → `loading` (caller shows a skeleton,
 *    so a refresh doesn't flash the composer then the banner)
 *  - archived channel → `archived`
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

    const { members, isLoading: membersLoading } = useChannelMembers(channelID, { autoFetch: !isDM })
    const isMember = isDM || members.some((m) => m.name === currentUser)

    const { joinChannel, loading: joining } = useJoinChannel(channelID)
    const { call } = useContext(FrappeContext) as FrappeConfig
    const onJoin = useCallback(() => {
        joinChannel()
            // Refresh the member store so the gate flips to `composer` immediately.
            .then(() => loadChannelMembers(call, channelID, true))
            .catch((e) => errorResponseToast(_("Could not join"), e))
    }, [joinChannel, call, channelID])

    let state: ComposerGateState
    if (!channelsLoaded || (!isDM && membersLoading)) state = "loading"
    else if (isArchived) state = "archived"
    else if (isOpen || isMember) state = "composer"
    else state = "not-member"

    return { state, onJoin, joining, canJoin }
}

export type ComposerGate = ReturnType<typeof useComposerGate>

/** Placeholder while we work out whether you can post — keeps the refresh from flashing. */
const ComposerSkeleton = () => (
    <div className="md:px-3 md:pb-3 w-full">
        <div className={cn("md:h-[98px] h-14 standalone:h-20",
            "w-full animate-pulse md:rounded-lg rounded-none md:border border-t border-outline-gray-2 bg-surface-gray-1")} />
    </div>
)

/** Shown in place of the composer when you can't post — archived, or not a member (with Join). */
const ComposerBlockedBanner = ({
    archived,
    onJoin,
    joining,
    isThread = false,
}: {
    archived: boolean
    onJoin?: () => void
    joining?: boolean,
    isThread?: boolean
}) => {

    const message = useMemo(() => {
        if (archived) {
            if (isThread) {
                return _("This thread is archived. You can't send new messages.")
            } else {
                return _("This channel is archived. You can't send new messages.")
            }
        } else {
            if (isThread) {
                return _("You're not a member of this thread.")
            } else {
                return _("You're not a member of this channel.")
            }
        }


    }, [archived, onJoin, joining, isThread])

    return <div className="md:px-3 md:pb-3 w-full">
        {/* max(inset, 1rem): Android Chrome reports a 0 safe-area inset (unlike
            iOS's 34px), which left this flush against the screen bottom. */}
        <div className="flex md:min-h-[98px] flex-col items-center justify-center gap-2 md:rounded-lg rounded-none md:border border-t border-outline-gray-2 bg-surface-gray-1 md:px-3 px-4 py-4 standalone:pb-[max(env(safe-area-inset-bottom),1rem)] text-sm text-ink-gray-6">
            <span className="text-p-base text-center">
                {message}
            </span>
            {!archived && onJoin && (
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
    if (gate.state === "archived") return <ComposerBlockedBanner archived isThread={isThread} />
    if (gate.state === "not-member") {
        // No Join button when joining isn't possible (a thread whose parent channel
        // the user isn't a member of) — the banner alone says "view only".
        return <ComposerBlockedBanner archived={false} onJoin={gate.canJoin ? gate.onJoin : undefined} joining={gate.joining} isThread={isThread} />
    }
    return <>{children}</>
}
