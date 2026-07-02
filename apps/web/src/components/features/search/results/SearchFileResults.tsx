import { memo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { MessageSquareMore } from 'lucide-react'
import _ from '@lib/translate'
import { formatRelativeDate } from '@lib/date'
import { useSqliteSearch, SearchResult } from '@hooks/useSqliteSearch'
import { useMessageRowLookups } from '@hooks/useMessageRowLookups'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import FileTypeIcon from '@components/common/FileIcons/FileTypeIcon'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import ErrorBanner from '@components/ui/error-banner'
import { formatBytes } from '@lib/file'
import { UserData } from '@db'
import { WorkspaceFields } from '@hooks/useWorkspaces'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import type { SelectedNotification } from '@pages/notifications/NotificationChat'
import { RESULT_ROW_ACTIVE_CLASS } from '@components/common/MessageResultBlock/MessageResultBlock'
import { cn } from '@lib/utils'
import { SearchFilters } from '../types'

interface SearchFileResultsProps {
    searchValue?: string
    filters: SearchFilters
    /** Opens the file's message in the right-pane split view. */
    onSelect: (selection: SelectedNotification) => void
    /** Open row id — highlights the active result. */
    selectedID?: string
}

const SearchFileResults = ({ searchValue, filters, onSelect, selectedID }: SearchFileResultsProps) => {
    const { results, isLoading, error } = useSqliteSearch(
        searchValue,
        { ...filters, message_type: filters.message_type || ['File', 'Image'] },
        100,
        (r) => r.title
    )
    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    if (error) return <ErrorBanner error={error} />
    if (isLoading || !results) return <MessageListSkeleton />
    if (results.length === 0) {
        return (
            <div className="text-sm text-ink-gray-4 text-center py-8">
                {_('No files found.')}
            </div>
        )
    }

    return (
        <Virtuoso
            data={results}
            style={{ height: '100%' }}
            initialItemCount={Math.min(results.length, 10)}
            computeItemKey={(_idx, file) => `${file.id}::${file.internal_link ?? ''}`}
            itemContent={(_idx, file) => {
                // Thread replies live in a thread channel; resolve display against the
                // real (parent) channel so selection carries the routing-ready id.
                const baseChannelId = file.parent_channel_id ?? file.channel_id
                const channel = channelById.get(baseChannelId)
                const dmChannel = dmById.get(baseChannelId)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <FileResultRow
                        file={file}
                        user={usersById.get(file.author)}
                        channel={channel}
                        dmChannel={dmChannel}
                        peer={peer}
                        workspace={channel?.workspace ? workspaceById.get(channel.workspace) : undefined}
                        className={selectedID === file.name ? RESULT_ROW_ACTIVE_CLASS : undefined}
                        onClick={() => onSelect({
                            channelID: baseChannelId,
                            messageID: file.name,
                            isDirectMessage: !!dmChannel,
                            peer,
                            isThread: !!file.is_thread,
                        })}
                    />
                )
            }}
        />
    )
}

interface FileResultRowProps {
    file: SearchResult
    user?: UserData
    channel?: ChannelListItem
    dmChannel?: DMChannelListItem
    peer?: UserData
    workspace?: WorkspaceFields
    onClick: () => void
    className?: string
}

const FileResultRowInner = ({ file, user, channel, dmChannel, peer, workspace, onClick, className }: FileResultRowProps) => {
    const peerName = peer?.full_name ?? dmChannel?.peer_user_id ?? ''
    const isImage = file.message_type === 'Image'
    const ext = (file.file_type || file.title?.split('.').pop() || '').toLowerCase()
    const sizeLabel = file.file_size ? formatBytes(file.file_size) : null
    const relativeDate = formatRelativeDate(file.creation)

    return (
        <div className="px-2 py-0.5">
            <div
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
                className={cn(
                    "group flex gap-3 px-2 py-3 md:py-2 rounded transition-colors text-left select-none cursor-pointer hover:bg-surface-gray-3 active:bg-surface-gray-3 focus-visible:bg-surface-gray-3 focus-visible:outline-none",
                    className
                )}
            >
                {user && <UserAvatar user={user} size="md" showStatusIndicator={false} />}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap text-base md:text-sm">
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

                    <div className="flex gap-3 mt-2">
                        {isImage && file.internal_link ? (
                            <img
                                src={file.internal_link}
                                alt={file.title ?? ''}
                                className="w-20 h-20 object-cover rounded-md border border-outline-gray-2 shrink-0 bg-surface-gray-2"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                        ) : (
                            <FileTypeIcon fileType={ext} size="4xl" />
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base md:text-sm font-medium text-ink-gray-8 truncate">{file.title || _('Untitled')}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-ink-gray-4 mt-0.5">
                                {ext && <span className="uppercase">{ext}</span>}
                                {ext && sizeLabel && <span>·</span>}
                                {sizeLabel && <span>{sizeLabel}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const FileResultRow = memo(FileResultRowInner)

export default SearchFileResults
