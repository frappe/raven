import { useMemo } from 'react'
import { ChannelListItem } from '@raven/types/common/ChannelListItem'
import { RavenUser } from '@raven/types/Raven/RavenUser'
import { buildChannelSidebarData } from '../utils/buildChannelSidebarData'

export type { ChannelHiddenReason, ChannelSidebarData, SidebarChannelItem } from '../utils/buildChannelSidebarData'

export const useGroupedChannels = (
    channels: ChannelListItem[],
    myProfile?: RavenUser,
    workspaceID?: string,
    options?: {
        /**
         * Keep channels the user's sidebar preferences would hide (not joined /
         * no recent activity), annotated with `_hiddenReason` instead of being
         * dropped. The Customize Sidebar dialog uses this: you can't organize a
         * channel you can't see. Archived channels stay excluded either way.
         * The SIDEBAR itself must never pass this.
         */
        includeHidden?: boolean
    },
) => {
    const includeHidden = options?.includeHidden ?? false
    return useMemo(
        () => buildChannelSidebarData(channels, myProfile, workspaceID, { includeHidden }),
        [
            channels,
            workspaceID,
            includeHidden,
            myProfile?.channel_groups,
            myProfile?.pinned_channels,
            myProfile?.grouped_channels,
            myProfile?.sort_channels_by,
            myProfile?.filter_recent_activity,
            myProfile?.filter_joined_channels,
        ],
    )
}
