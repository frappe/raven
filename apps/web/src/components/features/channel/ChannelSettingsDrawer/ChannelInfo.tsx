import { UserAvatar } from '@components/features/message/UserAvatar'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { useChannel } from '@hooks/useChannel'
import { useUser } from '@hooks/useUser'
import { formatDate } from '@lib/date'
import { canManageChannel } from '@lib/permissions'
import _ from '@lib/translate'
import { EditChannelDescriptionButton } from './EditChannelDescriptionButton'

/**
 * Identity header of the channel drawer — name, description, created-by. It sits
 * above the tabs and is always visible, so it stays read-only and compact; every
 * action (notifications, leave, admin changes) lives in the Settings tab instead.
 * Mirrors UserProfileDrawer, which fills this slot for DMs.
 */
const ChannelInfo = ({ channelID }: { channelID: string }) => {
    const { channel } = useChannel(channelID)
    const user = useUser(channel?.owner ?? "")

    if (!channel) {
        return null
    }

    return (
        <div className="flex flex-col gap-1 px-5 md:pt-3 pb-4">
            <div className="flex items-center gap-1.5 justify-between">
                <div className="flex items-center gap-1 overflow-hidden">
                    <ChannelIcon type={channel.type} className="size-4.5 shrink-0 text-ink-gray-7" />
                    <span className="text-xl-medium text-ink-gray-7 truncate" title={channel.channel_name}>{channel.channel_name}</span>
                </div>
                {canManageChannel(channel) && <EditChannelDescriptionButton channel={channel} />}
            </div>

            {channel.channel_description && (
                <p className="text-p-sm text-ink-gray-6 line-clamp-3">
                    {channel.channel_description}
                </p>
            )}

            {user && user.name !== "Administrator" && (
                <div className="flex items-center gap-1.5 pt-2">
                    <UserAvatar user={user} size="xs" showStatusIndicator={false} showBotIndicator={false} />
                    <span className="text-sm text-ink-gray-6">
                        {_(`Created by {0} on {1}`, [user.full_name, formatDate(channel.creation, "Do MMMM YYYY")])}
                    </span>
                </div>
            )}
        </div>
    )
}

export default ChannelInfo
