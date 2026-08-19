import dayjs from "dayjs"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import type { RavenUser } from "@raven/types/Raven/RavenUser"
import { sortChannels } from "./channelSort"

/** Why a channel is hidden from the sidebar by the user's own preferences. */
export type ChannelHiddenReason = "not_joined" | "no_recent_activity"

export type SidebarChannelItem = ChannelListItem & { _hiddenReason?: ChannelHiddenReason }

export interface ChannelSidebarData {
    groupedChannels: [string, SidebarChannelItem[]][]
    ungroupedChannels: SidebarChannelItem[]
}

/** The sidebar filters exist to tame a crowded sidebar. Below this many
 *  channels in the workspace (the absolute non-archived count, exemptions
 *  included) there is nothing to tame — hiding channels in a small workspace
 *  costs more than it helps — so the preferences only kick in from here up. */
const FILTER_MIN_CHANNELS = 15

export const buildChannelSidebarData = (
    channels: ChannelListItem[],
    myProfile?: RavenUser,
    workspaceID?: string,
    options?: { includeHidden?: boolean },
): ChannelSidebarData => {
    const includeHidden = options?.includeHidden ?? false

    const pool: ChannelListItem[] = []
    for (const ch of channels) {
        if (ch.workspace !== workspaceID) continue
        if (ch.is_archived) continue
        pool.push(ch)
    }

    const pinnedChannelIds = new Set(myProfile?.pinned_channels?.map((pin) => pin.channel_id) || [])
    const groupedChannelMap = new Map(
        myProfile?.grouped_channels?.map((gc) => [gc.channel_id, gc.channel_group]) || [],
    )
    const groupNames = new Set(myProfile?.channel_groups?.map((group) => group.group_name) || [])

    const showMyChannelsOnly = myProfile?.filter_joined_channels === 1
    const showRecentActivityOnly = myProfile?.filter_recent_activity === 1

    // A channel the filters are allowed to hide. Two standing exemptions:
    // - Open channels: membership is implicit — member_id is only created on
    //   the user's first visit — so "channels I've joined" would wrongly hide
    //   an Open channel the user simply hasn't opened yet. They are also the
    //   org-wide channels users must not lose, so they are never hidden.
    // - Curated channels (pinned, or in one of the user's groups): the user
    //   placed them by hand, and a filter un-placing them reads as data loss.
    const isFilterable = (ch: ChannelListItem) =>
        ch.type !== "Open" &&
        !pinnedChannelIds.has(ch.name) &&
        !groupNames.has(groupedChannelMap.get(ch.name) ?? "")

    const applyFilters =
        (showMyChannelsOnly || showRecentActivityOnly) && pool.length >= FILTER_MIN_CHANNELS

    const thirty_days_ago = dayjs().subtract(30, "days").format("YYYY-MM-DD")
    const workspaceChannels: SidebarChannelItem[] = []
    for (const ch of pool) {
        let hiddenReason: ChannelHiddenReason | undefined
        if (applyFilters && isFilterable(ch)) {
            if (showMyChannelsOnly && !ch.member_id) {
                hiddenReason = "not_joined"
            } else if (showRecentActivityOnly && dayjs(ch.last_message_timestamp).isBefore(thirty_days_ago)) {
                hiddenReason = "no_recent_activity"
            }
        }
        if (hiddenReason) {
            if (includeHidden) workspaceChannels.push({ ...ch, _hiddenReason: hiddenReason })
            continue
        }
        workspaceChannels.push(ch)
    }
    if (!myProfile || !workspaceChannels.length) {
        return { groupedChannels: [], ungroupedChannels: [] }
    }

    const groups = new Map<string, SidebarChannelItem[]>()
    const remainingChannels = new Set(workspaceChannels)
    // Favorites has no channel_groups row, so it has no sort_by of its own and
    // resolves to the global preference like the ungrouped list does.
    const sortByGroupName = new Map(
        myProfile.channel_groups?.map((group) => [group.group_name, group.sort_by]) || [],
    )

    if (pinnedChannelIds.size > 0) {
        groups.set("Favorites", [])
    }
    if (myProfile?.channel_groups && myProfile.channel_groups.length > 0) {
        myProfile.channel_groups.forEach((group) => {
            groups.set(group.group_name, [])
        })
    }

    workspaceChannels.forEach((ch) => {
        if (pinnedChannelIds.has(ch.name)) {
            groups.get("Favorites")?.push(ch)
            remainingChannels.delete(ch)
            return
        }
        const channelGroup = groupedChannelMap.get(ch.name)
        if (channelGroup) {
            const group = groups.get(channelGroup)
            if (group) {
                group.push(ch)
                remainingChannels.delete(ch)
            }
            return
        }
    })

    const globalSort = myProfile?.sort_channels_by
    const groupedChannels = Array.from(groups)
        .filter(([, groupChannels]) => groupChannels.length > 0)
        .map(([groupName, groupChannels]): [string, SidebarChannelItem[]] => [
            groupName,
            sortChannels(groupChannels, sortByGroupName.get(groupName) || globalSort),
        ])

    const ungroupedChannels = sortChannels(Array.from(remainingChannels), globalSort)

    return { groupedChannels, ungroupedChannels }
}
