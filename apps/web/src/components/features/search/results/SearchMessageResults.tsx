import { Virtuoso } from 'react-virtuoso'
import { useSqliteSearch } from '@hooks/useSqliteSearch'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import _ from '@lib/translate'
import ErrorBanner from '@components/ui/error-banner'
import { MessageResultBlock, RESULT_ROW_ACTIVE_CLASS } from '@components/common/MessageResultBlock/MessageResultBlock'
import { searchResultToMessage } from '@components/common/MessageResultBlock/searchResultToMessage'
import { useMessageRowLookups } from '@hooks/useMessageRowLookups'
import type { SelectedNotification } from '@pages/notifications/NotificationChat'
import { SearchFilters } from '../types'

interface SearchMessageResultsProps {
    searchValue?: string
    filters: SearchFilters
    /** Opens the message in the right-pane split view. */
    onSelect: (selection: SelectedNotification) => void
    /** Open row id — highlights the active result. */
    selectedID?: string
}

const SearchMessageResults = ({ searchValue, filters, onSelect, selectedID }: SearchMessageResultsProps) => {
    const { results, isLoading, error } = useSqliteSearch(
        searchValue,
        { ...filters, message_type: filters.message_type || 'Text' },
        100,
        (r) => r.content
    )

    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    if (error) return <ErrorBanner error={error} />
    if (isLoading || !results) return <MessageListSkeleton />
    if (results.length === 0) {
        return (
            <div className="text-sm text-ink-gray-4 text-center py-8">
                {_('No messages found.')}
            </div>
        )
    }

    return (
        <Virtuoso
            data={results}
            style={{ height: '100%' }}
            initialItemCount={Math.min(results.length, 10)}
            computeItemKey={(_idx, r) => r.id}
            itemContent={(_idx, r) => {
                // Thread replies live in a thread channel; resolve display against the
                // real (parent) channel so selection carries the routing-ready id.
                const baseChannelId = r.parent_channel_id ?? r.channel_id
                const channel = channelById.get(baseChannelId)
                const dmChannel = dmById.get(baseChannelId)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <MessageResultBlock
                        message={searchResultToMessage(r)}
                        user={usersById.get(r.author)}
                        channel={channel}
                        dmChannel={dmChannel}
                        peer={peer}
                        workspace={channel?.workspace ? workspaceById.get(channel.workspace) : undefined}
                        className={selectedID === r.name ? RESULT_ROW_ACTIVE_CLASS : undefined}
                        onClick={() => onSelect({
                            channelID: baseChannelId,
                            messageID: r.name,
                            isDirectMessage: !!dmChannel,
                            peer,
                            isThread: !!r.is_thread,
                        })}
                    />
                )
            }}
        />
    )
}

export default SearchMessageResults
