import { memo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useFrappeEventListener } from 'frappe-react-sdk'
import { MessageSquareMore } from 'lucide-react'
import _ from '@lib/translate'
import { formatRelativeDate } from '@lib/date'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { Skeleton } from '@components/ui/skeleton'
import ErrorBanner from '@components/ui/error-banner'
import { LinkSearchResult, useLinkSearch } from '@hooks/useLinkSearch'
import { UserData } from '@db'
import { WorkspaceFields } from '@hooks/useWorkspaces'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import { useMessageRowLookups } from '@hooks/useMessageRowLookups'
import type { SelectedNotification } from '@pages/notifications/NotificationChat'
import { RESULT_ROW_ACTIVE_CLASS } from '@components/common/MessageResultBlock/MessageResultBlock'
import { searchResultToSelection } from '@components/common/MessageResultBlock/searchResultToSelection'
import { cn } from '@lib/utils'
import { SearchFilters } from '../types'
import { SearchNoResults } from './SearchNoResults'
import { LinkResultContent } from '@components/common/LinkResultBlock/LinkResultContent'

interface SearchLinkResultsProps {
    searchValue?: string
    filters: SearchFilters
    /** Opens the link's message in the right-pane split view. */
    onSelect: (selection: SelectedNotification) => void
    /** Open row id — highlights the active result. */
    selectedID?: string
}

const SearchLinkResults = ({ searchValue, filters, onSelect, selectedID }: SearchLinkResultsProps) => {
    const { results, isLoading, error, mutate } = useLinkSearch(searchValue, filters, 100)
    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    useFrappeEventListener('link_previews_updated', () => mutate())

    if (error) return <ErrorBanner error={error} />
    if (isLoading) return <LinkPreviewSkeletonList />
    if (results.length === 0) return <SearchNoResults title={_('No links found')} />

    return (
        <Virtuoso
            data={results}
            style={{ height: '100%' }}
            initialItemCount={Math.min(results.length, 10)}
            computeItemKey={(idx, link) => link ? `${link.id}::${link.url}` : idx}
            itemContent={(_idx, link) => {
                // Results can shrink between renders (short-query fallback filters per
                // keystroke) while Virtuoso still holds the old index range — skip the
                // out-of-range frame; the next render drops the row.
                if (!link) return null
                // Display only: thread replies live in a thread channel, so resolve the
                // row's channel/avatar against the real (parent) channel. Routing is
                // handled separately by searchResultToSelection.
                const baseChannelId = link.parent_channel_id ?? link.channel_id
                const channel = channelById.get(baseChannelId)
                const dmChannel = dmById.get(baseChannelId)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <LinkResultRow
                        link={link}
                        user={usersById.get(link.author)}
                        channel={channel}
                        dmChannel={dmChannel}
                        peer={peer}
                        workspace={channel?.workspace ? workspaceById.get(channel.workspace) : undefined}
                        className={selectedID === link.id ? RESULT_ROW_ACTIVE_CLASS : undefined}
                        onClick={() => onSelect(searchResultToSelection({
                            messageID: link.id,
                            channelID: link.channel_id,
                            parentChannelID: link.parent_channel_id,
                            isThreadRoot: !!link.is_thread,
                            isDirectMessage: !!dmChannel,
                            peer,
                        }))}
                    />
                )
            }}
        />
    )
}

interface LinkResultRowProps {
    link: LinkSearchResult
    user?: UserData
    channel?: ChannelListItem
    dmChannel?: DMChannelListItem
    peer?: UserData
    workspace?: WorkspaceFields
    onClick: () => void
    className?: string
}

const LinkResultRowInner = ({ link, user, channel, dmChannel, peer, workspace, onClick, className }: LinkResultRowProps) => {
    const peerName = peer?.full_name ?? dmChannel?.peer_user_id ?? ''
    const relativeDate = formatRelativeDate(link.creation)

    return (
        // Mobile rows run edge to edge (the tab panel has no gutter): the
        // card keeps only INTERNAL padding, and the corners square off
        // since a flush surface has no edges to round. Desktop keeps the
        // inset rounded rows.
        <div className="py-0.5 md:px-2">
            <div
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
                className={cn(
                    "group flex gap-3 px-4 md:px-2 py-3 md:py-2 rounded-none md:rounded transition-colors text-left select-none cursor-pointer hover:bg-surface-gray-3 active:bg-surface-gray-3 focus-visible:bg-surface-gray-3 focus-visible:outline-none",
                    className
                )}
            >
                {user && <UserAvatar user={user} size="md" showStatusIndicator={false} />}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap text-content">
                        {user && <span className="font-medium text-ink-gray-8 truncate">{user.full_name}</span>}
                        <span className="shrink-0 text-xs text-ink-gray-4">{relativeDate}</span>
                        {workspace && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <span className="text-ink-gray-4 truncate min-w-0">{workspace.workspace_name}</span>
                            </>
                        )}
                        {channel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <ChannelIcon type={channel.type} className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{channel.channel_name}</span>
                            </>
                        )}
                        {dmChannel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <MessageSquareMore className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{peerName}</span>
                            </>
                        )}
                    </div>

                    {/* The link block itself is shared with the channel
                        settings drawer — see LinkResultContent. */}
                    <div className="mt-2">
                        <LinkResultContent link={link} />
                    </div>
                </div>
            </div>
        </div>
    )
}

const LinkResultRow = memo(LinkResultRowInner)

const LinkPreviewSkeletonList = () => (
    <div className="flex w-full flex-col space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
                <Skeleton className="h-16 w-28 rounded-md shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton className="h-4" style={{ width: `${45 + (i % 4) * 15}%` }} />
                    <Skeleton className="h-3" style={{ width: '70%' }} />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
        ))}
    </div>
)

export default SearchLinkResults
