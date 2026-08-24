import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { RavenUser } from "@raven/types/Raven/RavenUser"
import { RavenChannelGroups } from "@raven/types/RavenChannelManagement/RavenChannelGroups"
import { RavenGroupedChannels } from "@raven/types/Raven/RavenGroupedChannels"
import { RavenPinnedChannels } from "@raven/types/Raven/RavenPinnedChannels"
import {
    assignChannelToGroup,
    isDuplicateGroupName,
    removeGroupFromChannels,
    renameGroupInChannels,
    reorderGroups,
} from "@raven/lib/utils/channelGroups"
import _ from "@lib/translate"

/** Sentinel values the channel table's Select multiplexes alongside real group names. */
export const NEW_GROUP_VALUE = "__new_group__"
export const UNGROUP_VALUE = "__ungroup__"

/**
 * Names a group may never take.
 *
 * The two sentinels would collide with the Select's own items — a group named
 * `__ungroup__` would ungroup the channel instead of assigning it, and become
 * permanently unselectable. "Favorites" is worse: it is a pseudo-group backed by
 * `pinned_channels` with no channel_groups row, so it passes the duplicate check,
 * then assignChannel routes it into the PIN branch — the channel gets starred and
 * the new group is left empty, which means the preview drops it and it can never
 * be renamed or deleted.
 *
 * Enforced here, in the single writer, so create AND rename are both covered.
 */
const RESERVED_GROUP_NAMES = [NEW_GROUP_VALUE, UNGROUP_VALUE, "Favorites"]

const isReservedGroupName = (name: string) =>
    RESERVED_GROUP_NAMES.some((reserved) => reserved.toLowerCase() === name.trim().toLowerCase())

type SortValue = "" | "Alphabetical Order" | "Recent Activity"
type Result = { ok: true } | { ok: false; error: string }

/**
 * Single writer for the three Raven User child tables the panel edits.
 *
 * Creation happens in the channel table and rename/delete/reorder happen in the
 * preview, so without this hook two sibling components would mutate the same
 * field arrays and each would have to re-implement the invariants: rename
 * cascades by name, a channel is pinned XOR grouped, and idx renumbers across
 * the full array including the empty groups the preview hides.
 *
 * Everything stays form state — the panel's Save button writes it in one updateDoc.
 *
 * Held in context and consumed through the hook below: the panel renders one
 * ChannelGroupSelect per VISIBLE TABLE ROW plus one PreviewGroupHeader per group,
 * so calling this directly gave each of them its own useWatch subscription to the
 * same `channel_groups` field — all re-rendering on every mutation, and the count
 * scaling with the channel list. One subscription now feeds all of them.
 */
const useChannelGroupsValue = () => {
    const { control, getValues, setValue } = useFormContext<RavenUser>()

    const groups = (useWatch({ control, name: "channel_groups" }) ?? []) as RavenChannelGroups[]

    const commitGroups = (next: RavenChannelGroups[]) =>
        setValue("channel_groups", next, { shouldDirty: true })

    const createGroup = (name: string, assignChannelId?: string): Result => {
        const trimmed = name.trim()
        if (!trimmed) return { ok: false, error: _("Group name is required") }
        if (isReservedGroupName(trimmed)) return { ok: false, error: _("This name is reserved, please choose another") }

        const current = getValues("channel_groups") ?? []
        if (isDuplicateGroupName(current, trimmed)) {
            return { ok: false, error: _("A group with this name already exists") }
        }

        commitGroups([...current, { group_name: trimmed, idx: current.length + 1 } as RavenChannelGroups])
        if (assignChannelId) assignChannel(assignChannelId, trimmed)

        return { ok: true }
    }

    const renameGroup = (index: number, name: string): Result => {
        const trimmed = name.trim()
        if (!trimmed) return { ok: false, error: _("Group name is required") }
        if (isReservedGroupName(trimmed)) return { ok: false, error: _("This name is reserved, please choose another") }

        const current = getValues("channel_groups") ?? []
        if (isDuplicateGroupName(current, trimmed, index)) {
            return { ok: false, error: _("A group with this name already exists") }
        }

        const oldName = current[index]?.group_name
        if (!oldName) return { ok: false, error: _("Group not found") }

        commitGroups(current.map((group, i) => (i === index ? { ...group, group_name: trimmed } : group)))
        setValue("grouped_channels", renameGroupInChannels(getValues("grouped_channels") ?? [], oldName, trimmed), {
            shouldDirty: true,
        })

        return { ok: true }
    }

    const deleteGroup = (index: number) => {
        const current = getValues("channel_groups") ?? []
        const removed = current[index]?.group_name
        if (!removed) return

        commitGroups(current.filter((_group, i) => i !== index).map((group, i) => ({ ...group, idx: i + 1 })))
        setValue("grouped_channels", removeGroupFromChannels(getValues("grouped_channels") ?? [], removed), {
            shouldDirty: true,
        })
    }

    const reorder = (fromName: string, toName: string) => {
        const current = getValues("channel_groups") ?? []
        const next = reorderGroups(current, fromName, toName)
        if (next !== current) commitGroups(next)
    }

    const setGroupSort = (index: number, sort: SortValue) => {
        const current = getValues("channel_groups") ?? []
        commitGroups(current.map((group, i) => (i === index ? { ...group, sort_by: sort } : group)))
    }

    const assignChannel = (channelId: string, target: string | "Favorites" | null) => {
        const { grouped, pinned } = assignChannelToGroup(
            getValues("grouped_channels") ?? [],
            getValues("pinned_channels") ?? [],
            channelId,
            target,
        )
        setValue("grouped_channels", grouped as RavenGroupedChannels[], { shouldDirty: true })
        setValue("pinned_channels", pinned as RavenPinnedChannels[], { shouldDirty: true })
    }

    // Identity is stable unless the groups array actually changes, so consumers do
    // not re-render just because the provider's parent did. The closures read live
    // form state via getValues, so they never go stale.
    return useMemo(
        () => ({ groups, createGroup, renameGroup, deleteGroup, reorder, setGroupSort, assignChannel }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [groups],
    )
}

type ChannelGroupsValue = ReturnType<typeof useChannelGroupsValue>

const ChannelGroupsContext = createContext<ChannelGroupsValue | null>(null)

export const ChannelGroupsProvider = ({ children }: { children: ReactNode }) => {
    const value = useChannelGroupsValue()
    return <ChannelGroupsContext.Provider value={value}>{children}</ChannelGroupsContext.Provider>
}

/** Read/write access to the panel's group state. Must be inside ChannelGroupsProvider. */
export const useChannelGroups = () => {
    const value = useContext(ChannelGroupsContext)
    if (!value) throw new Error("useChannelGroups must be used within a ChannelGroupsProvider")
    return value
}
