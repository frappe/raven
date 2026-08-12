import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuSwitchItem,
    DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import { PrefRow, PrefSection } from '@components/features/profile/PrefRows'
import { useChannel } from '@hooks/useChannel'
import { useIsMobile } from '@hooks/use-mobile'
import { canManageChannel } from '@lib/permissions'
import _ from '@lib/translate'
import { ChannelTypeSelect } from './ChannelTypeSelect'
import { ArchiveChannelButton } from './ArchiveChannelButton'
import { DeleteChannelButton } from './DeleteChannelButton'
import { LeaveChannelButton } from './LeaveChannelButton'

/**
 * The Settings tab of the channel drawer — the PreferencesDrawer idiom: flat,
 * divided rows in captioned sections, notification toggles first, then the
 * channel actions, with Delete quarantined in its own section at the bottom.
 *
 * Admin-only rows are HIDDEN for non-admins, not disabled — permissions can't
 * change from inside this drawer, and a control the user can never use is
 * noise, not affordance. (Disabled is for temporary states.)
 */
const ChannelSettingsTab = ({ channelID }: { channelID: string }) => {
    const { channel } = useChannel(channelID)

    if (!channel) return null

    const allowSettingChange = canManageChannel(channel)
    const canLeave = channel.type !== 'Open'

    return (
        <div className="flex flex-col gap-6 px-1 py-2">
            <PrefSection title={_('Notifications')}>
                <PushNotificationsRow />
                <InAppNotificationsRow />
            </PrefSection>

            {(allowSettingChange || canLeave) && (
                <PrefSection title={_('Channel')}>
                    {allowSettingChange && <ChannelTypeSelect channel={channel} />}
                    {allowSettingChange && <ArchiveChannelButton channel={channel} />}
                    {canLeave && <LeaveChannelButton channel={channel} />}
                </PrefSection>
            )}

            {/* Delete sits alone — it's of a different magnitude than the other
                actions, and its neighbors shouldn't share its blast radius. */}
            {allowSettingChange && (
                <PrefSection>
                    <DeleteChannelButton channel={channel} />
                </PrefSection>
            )}
        </div>
    )
}

/* ----- Notification preferences (UI only) -----
 *
 * TODO(backend): local state for now. Both surfaces are per-event booleans on
 * the channel member — push additionally has an "all messages" master (relates
 * to the existing allow_notifications flag). The notification pipeline needs to
 * honor these; the `muted` member flag (badge suppression) is a separate,
 * coarser control and may join this group later.
 *
 * UI: one row per surface, the row shows a SUMMARY of what's on, and the
 * dropdown holds per-event SWITCH items (DropdownMenuSwitchItem — stays open
 * while toggling) — the knobs exist, but only when you go looking.
 */

/** "Mentions & replies" / "Mentions, Reactions" / "All messages" / "Off". */
const summarize = (parts: { label: string; on: boolean }[]): string => {
    const on = parts.filter((part) => part.on).map((part) => part.label)
    if (on.length === 0) return _('Off')
    if (on.length === 2) return _('{0} & {1}', [on[0], on[1]])
    return on.join(', ')
}

const NotificationRow = ({
    label,
    description,
    summary,
    children,
}: {
    label: string
    description?: string
    summary: string
    children: React.ReactNode
}) => (
    // children = DropdownMenuSwitchItems; NotificationSwitchItem below sets
    // their touch-friendly switch size.
    <PrefRow
        label={label}
        description={description}
        control={
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex items-center gap-1 text-base md:text-sm text-ink-gray-7 data-[state=open]:text-ink-gray-9"
                    >
                        {summary}
                        <ChevronDown className="size-4 shrink-0 text-ink-gray-5" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {children}
                </DropdownMenuContent>
            </DropdownMenu>
        }
    />
)

/** Switch items sized for the viewport — md switches on touch. */
const NotificationSwitchItem = (props: React.ComponentProps<typeof DropdownMenuSwitchItem>) => {
    const isMobile = useIsMobile()
    return <DropdownMenuSwitchItem switchSize={isMobile ? 'md' : 'sm'} {...props} />
}

const PushNotificationsRow = () => {
    const [allMessages, setAllMessages] = useState(false)
    const [mentions, setMentions] = useState(true)
    const [replies, setReplies] = useState(true)

    const summary = allMessages
        ? _('All messages')
        : summarize([
            { label: _('Mentions'), on: mentions },
            { label: _('Replies'), on: replies },
        ])

    return (
        <NotificationRow label={_('Push notifications')} summary={summary}>
            <NotificationSwitchItem checked={allMessages} onCheckedChange={setAllMessages}>
                {_('All messages')}
            </NotificationSwitchItem>
            <DropdownMenuSeparator />
            {/* Subsumed while "All messages" is on; choices are kept for when
                it's turned back off */}
            <NotificationSwitchItem checked={mentions} onCheckedChange={setMentions} disabled={allMessages}>
                {_('Mentions')}
            </NotificationSwitchItem>
            <NotificationSwitchItem checked={replies} onCheckedChange={setReplies} disabled={allMessages}>
                {_('Replies')}
            </NotificationSwitchItem>
        </NotificationRow>
    )
}

const InAppNotificationsRow = () => {
    const [mentions, setMentions] = useState(true)
    const [replies, setReplies] = useState(true)
    const [reactions, setReactions] = useState(true)

    const summary =
        mentions && replies && reactions
            ? _('All activity')
            : summarize([
                { label: _('Mentions'), on: mentions },
                { label: _('Replies'), on: replies },
                { label: _('Reactions'), on: reactions },
            ])

    return (
        <NotificationRow
            label={_('In-app notifications')}
            description={_('What shows up in your Notifications tab')}
            summary={summary}
        >
            <NotificationSwitchItem checked={mentions} onCheckedChange={setMentions}>
                {_('Mentions')}
            </NotificationSwitchItem>
            <NotificationSwitchItem checked={replies} onCheckedChange={setReplies}>
                {_('Replies')}
            </NotificationSwitchItem>
            <NotificationSwitchItem checked={reactions} onCheckedChange={setReactions}>
                {_('Reactions')}
            </NotificationSwitchItem>
        </NotificationRow>
    )
}

export default ChannelSettingsTab
