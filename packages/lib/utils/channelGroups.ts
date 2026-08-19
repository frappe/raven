export interface GroupRow {
    group_name: string
    idx?: number
    sort_by?: string
}

export interface GroupedRow {
    channel_id: string
    channel_group: string
}

export interface PinnedRow {
    channel_id: string
}

const normalise = (name: string) => name.trim().toLowerCase()

/** Group names must be unique per user — grouped_channels references them by name. */
export const isDuplicateGroupName = (groups: GroupRow[], name: string, ignoreIndex?: number): boolean =>
    groups.some((group, index) => index !== ignoreIndex && normalise(group.group_name) === normalise(name))

/**
 * Move `fromName` to `toName`'s position and renumber `idx` across the WHOLE
 * array. The preview drags a subset (empty groups are hidden), so positions are
 * resolved by name against the full array rather than by visible index — an
 * arrayMove over the visible list would silently reorder the hidden ones.
 * Returns the same reference when nothing moves.
 */
export const reorderGroups = <T extends GroupRow>(groups: T[], fromName: string, toName: string): T[] => {
    const from = groups.findIndex((group) => group.group_name === fromName)
    const to = groups.findIndex((group) => group.group_name === toName)

    if (from < 0 || to < 0 || from === to) return groups

    const next = [...groups]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    return next.map((group, index) => ({ ...group, idx: index + 1 }))
}

/** Renaming cascades: grouped_channels stores the group NAME, not an id. */
export const renameGroupInChannels = <T extends GroupedRow>(rows: T[], oldName: string, newName: string): T[] =>
    rows.map((row) => (row.channel_group === oldName ? { ...row, channel_group: newName } : row))

/** Deleting a group ungroups its members rather than deleting them. */
export const removeGroupFromChannels = <T extends GroupedRow>(rows: T[], groupName: string): T[] =>
    rows.filter((row) => row.channel_group !== groupName)

/**
 * Assign a channel to a group, to Favorites, or to nothing.
 * A channel is pinned XOR grouped — never both.
 */
export const assignChannelToGroup = (
    grouped: GroupedRow[],
    pinned: PinnedRow[],
    channelId: string,
    target: string | "Favorites" | null,
): { grouped: GroupedRow[]; pinned: PinnedRow[] } => {
    const withoutChannel = grouped.filter((row) => row.channel_id !== channelId)
    const unpinned = pinned.filter((row) => row.channel_id !== channelId)

    if (target === "Favorites") {
        return { grouped: withoutChannel, pinned: [...unpinned, { channel_id: channelId }] }
    }

    if (target === null) {
        return { grouped: withoutChannel, pinned: unpinned }
    }

    return { grouped: [...withoutChannel, { channel_id: channelId, channel_group: target }], pinned: unpinned }
}
