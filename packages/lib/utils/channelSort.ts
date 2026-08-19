import type { ChannelListItem } from "@raven/types/common/ChannelListItem"

/** Values `Raven User.sort_channels_by` and `Raven Channel Groups.sort_by` can hold. */
export type ChannelSortMode = "Alphabetical Order" | "Recent Activity" | "Unreads First"

/**
 * Order channels for one sidebar section. Returns a new array.
 *
 * "Unreads First" is accepted but not implemented upstream (see the TODO in
 * useGroupedChannels) so it resolves to Recent Activity, as does an empty mode.
 * Frappe timestamps are fixed-width `YYYY-MM-DD HH:MM:SS.ffffff`, so a
 * lexicographic compare is chronological — no Date parsing in this hot path.
 */
export const sortChannels = <T extends ChannelListItem>(channels: T[], mode?: string): T[] => {
    const sorted = [...channels]

    if (mode === "Alphabetical Order") {
        return sorted.sort((a, b) => a.channel_name.localeCompare(b.channel_name))
    }

    return sorted.sort((a, b) => {
        const ta = a.last_message_timestamp ?? ""
        const tb = b.last_message_timestamp ?? ""
        return ta < tb ? 1 : ta > tb ? -1 : 0
    })
}
