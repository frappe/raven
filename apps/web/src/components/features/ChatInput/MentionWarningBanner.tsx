import { useMemo } from "react"
import { TreePalm, Info, type LucideIcon } from "lucide-react"
import { useChannelMembers } from "@hooks/useChannelMembers"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { leaveStore } from "@stores/leave/store"
import { formatNameList } from "@lib/nameList"
import _ from "@lib/translate"

/**
 * Heads-up shown above the composer when the drafted message @-mentions someone
 * who's on leave today and/or isn't in this channel. Informational only — it doesn't
 * block sending or offer an action (adding members can come later).
 *
 * One row per WARNING KIND, not per person: mentioning five outsiders yields a
 * single "A, B and 3 others aren't in this channel…" line instead of a stack of
 * five. Every sentence is a whole translatable template in a singular/plural
 * pair (verb agreement can't be composed from fragments), and the name list
 * itself goes through formatNameList's translatable templates.
 *
 * Rendered by ChatInput only when there's at least one mention, so the member fetch
 * is deferred until then. Leave is read from the store at compute time (it's seeded
 * at app start and changes daily, so it doesn't need a live subscription here).
 */
export const MentionWarningBanner = ({ channelID, mentionedIds, isThread = false }: { channelID: string; mentionedIds: string[]; isThread?: boolean }) => {
    const { memberIds, isLoading } = useChannelMembers(channelID)
    const usersById = useUsersById()

    const rows = useMemo(() => {
        const memberSet = new Set(memberIds)
        // Only flag non-members once we actually know the membership (avoid a flash of
        // "not in channel" for everyone before the list loads).
        const membersKnown = !isLoading && memberIds.length > 0

        // Three buckets, mutually exclusive per person — someone both on leave
        // AND outside the channel gets the combined sentence, not two mentions
        // in two rows.
        const onLeaveAndOutside: string[] = []
        const onLeave: string[] = []
        const outside: string[] = []
        for (const id of mentionedIds) {
            const away = leaveStore.isOnLeave(id)
            const notMember = membersKnown && !memberSet.has(id)
            if (away && notMember) onLeaveAndOutside.push(id)
            else if (away) onLeave.push(id)
            else if (notMember) outside.push(id)
        }

        // Up to 3 people the sentence names them inline; beyond that it switches
        // to the "The following people …: A, B, C, D" form — EVERYONE is named
        // (a "2 others" the user can't inspect helps nobody), and the list-after-
        // a-colon shape stays readable at any length.
        const names = (ids: string[]) =>
            formatNameList(ids.map((id) => usersById.get(id)?.full_name || id))
        const allNames = (ids: string[]) =>
            ids.map((id) => usersById.get(id)?.full_name || id).join(", ")

        const result: { key: string; icon: LucideIcon; text: string }[] = []
        if (onLeaveAndOutside.length > 0) {
            result.push({
                key: "leave-outside",
                icon: TreePalm,
                text: onLeaveAndOutside.length === 1
                    ? _("{0} is on leave today and isn't in this channel.", [names(onLeaveAndOutside)])
                    : onLeaveAndOutside.length <= 3
                        ? _("{0} are on leave today and aren't in this channel.", [names(onLeaveAndOutside)])
                        : _("The following people are on leave today and aren't in this channel: {0}", [allNames(onLeaveAndOutside)]),
            })
        }
        if (onLeave.length > 0) {
            result.push({
                key: "leave",
                icon: TreePalm,
                text: onLeave.length === 1
                    ? _("{0} is on leave today.", [names(onLeave)])
                    : onLeave.length <= 3
                        ? _("{0} are on leave today.", [names(onLeave)])
                        : _("The following people are on leave today: {0}", [allNames(onLeave)]),
            })
        }
        if (outside.length > 0) {
            result.push({
                key: "outside",
                icon: Info,
                text: isThread
                    ? outside.length === 1
                        ? _("{0} isn't in this channel and won't be added to this thread.", [names(outside)])
                        : outside.length <= 3
                            ? _("{0} aren't in this channel and won't be added to this thread.", [names(outside)])
                            : _("The following people aren't in this channel and won't be added to this thread: {0}", [allNames(outside)])
                    : outside.length === 1
                        ? _("{0} isn't in this channel and won't be notified.", [names(outside)])
                        : outside.length <= 3
                            ? _("{0} aren't in this channel.", [names(outside)])
                            : _("The following people aren't in this channel: {0}", [allNames(outside)]),
            })
        }
        return result
    }, [mentionedIds, memberIds, isLoading, usersById, isThread])

    if (rows.length === 0) return null

    return (
        <div className="flex flex-col gap-1 rounded-md bg-surface-amber-2 dark:bg-surface-elevation-2 px-3 py-2 md:mx-0 mx-1">
            {rows.map((row) => (
                <div key={row.key} className="flex items-start gap-1.5 text-p-xs text-ink-gray-7">
                    {/* h-[1lh]: a box exactly one LINE tall, icon centered inside it.
                        items-center on the row drifts the icon to the middle of
                        WRAPPED text; bare items-start sits it above the text's
                        visual center (the line box's half-leading). This pins the
                        icon to the first line's optical center at any wrap count —
                        and tracks the type token instead of a magic margin. */}
                    <span className="flex h-lh shrink-0 items-center" aria-hidden="true">
                        <row.icon className="size-4 text-ink-amber-8" />
                    </span>
                    <span>{row.text}</span>
                </div>
            ))}
        </div>
    )
}
