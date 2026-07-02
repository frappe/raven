import { useMemo } from "react"
import { TreePalm, Info } from "lucide-react"
import { useChannelMembers } from "@hooks/useChannelMembers"
import { useUser } from "@hooks/useUser"
import { leaveStore } from "@stores/leave/store"
import _ from "@lib/translate"

/**
 * Heads-up shown above the composer when the drafted message @-mentions someone
 * who's on leave today and/or isn't in this channel. Informational only — it doesn't
 * block sending or offer an action (adding members can come later).
 *
 * Rendered by ChatInput only when there's at least one mention, so the member fetch
 * is deferred until then. Leave is read from the store at compute time (it's seeded
 * at app start and changes daily, so it doesn't need a live subscription here).
 */
export const MentionWarningBanner = ({ channelID, mentionedIds, isThread = false }: { channelID: string; mentionedIds: string[]; isThread?: boolean }) => {
    const { memberIds, isLoading } = useChannelMembers(channelID)

    const warnings = useMemo(() => {
        const memberSet = new Set(memberIds)
        // Only flag non-members once we actually know the membership (avoid a flash of
        // "not in channel" for everyone before the list loads).
        const membersKnown = !isLoading && memberIds.length > 0
        return mentionedIds
            .map((id) => ({
                id,
                onLeave: leaveStore.isOnLeave(id),
                notMember: membersKnown && !memberSet.has(id),
            }))
            .filter((w) => w.onLeave || w.notMember)
    }, [mentionedIds, memberIds, isLoading])

    if (warnings.length === 0) return null

    return (
        <div className="pt-2">
            <div className="flex flex-col gap-1 rounded-md bg-surface-amber-2 px-3 py-2">
                {warnings.map((w) => (
                    <MentionWarningRow key={w.id} userID={w.id} onLeave={w.onLeave} notMember={w.notMember} isThread={isThread} />
                ))}
            </div>
        </div>
    )
}

const MentionWarningRow = ({ userID, onLeave, notMember, isThread = false }: { userID: string; onLeave: boolean; notMember: boolean; isThread?: boolean }) => {
    const user = useUser(userID)
    const name = user?.full_name || user?.name || userID

    const text = useMemo(() => {
        if (onLeave && notMember) {
            return _("{0} is on leave today and isn't in this channel.", [name])
        }
        if (onLeave) {
            return _("{0} is on leave today.", [name])
        }

        if (isThread) {
            return _("{0} isn't in this channel and won't be added to this thread.", [name])
        }

        return _("{0} isn't in this channel and won't be notified.", [name])

    }, [onLeave, notMember, isThread, name])

    const Icon = onLeave ? TreePalm : Info

    return (
        <div className="flex items-center gap-2 text-xs text-ink-gray-7">
            <Icon className="size-3.5 shrink-0 text-ink-amber-8" aria-hidden="true" />
            <span>{text}</span>
        </div>
    )
}
