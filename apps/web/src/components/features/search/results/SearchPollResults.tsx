import { Virtuoso } from 'react-virtuoso'
import { useSqliteSearch } from '@hooks/useSqliteSearch'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import _ from '@lib/translate'
import ErrorBanner from '@components/ui/error-banner'
import { MessageResultBlock, RESULT_ROW_ACTIVE_CLASS } from '@components/common/MessageResultBlock/MessageResultBlock'
import { searchResultToMessage } from '@components/common/MessageResultBlock/searchResultToMessage'
import { searchResultToSelection } from '@components/common/MessageResultBlock/searchResultToSelection'
import { useMessageRowLookups } from '@hooks/useMessageRowLookups'
import type { SelectedNotification } from '@pages/notifications/NotificationChat'
import { SearchFilters } from '../types'
import { SearchNoResults } from './SearchNoResults'

interface SearchPollResultsProps {
    searchValue?: string
    filters: SearchFilters
    /** Opens the message in the right-pane split view. */
    onSelect: (selection: SelectedNotification) => void
    /** Open row id — highlights the active result. */
    selectedID?: string
}

const SearchPollResults = ({ searchValue, filters, onSelect, selectedID }: SearchPollResultsProps) => {
    const { results, isLoading, error } = useSqliteSearch(
        searchValue,
        { ...filters, message_type: 'Poll' },
        100,
    )

    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    if (error) return <ErrorBanner error={error} />
    if (isLoading || !results) return <MessageListSkeleton />
    if (results.length === 0) return <SearchNoResults title={_('No polls found')} />

    return (
        <Virtuoso
            data={results}
            style={{ height: '100%' }}
            initialItemCount={Math.min(results.length, 10)}
            computeItemKey={(idx, r) => r?.id ?? idx}
            itemContent={(_idx, r) => {
                // Results can shrink between renders (short-query fallback filters per
                // keystroke) while Virtuoso still holds the old index range — skip the
                // out-of-range frame; the next render drops the row.
                if (!r) return null
                // Display only: thread replies live in a thread channel, so resolve the
                // row's channel/avatar against the real (parent) channel. Routing is
                // handled separately by searchResultToSelection.
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
                        onClick={() => onSelect(searchResultToSelection({
                            messageID: r.name,
                            channelID: r.channel_id,
                            parentChannelID: r.parent_channel_id,
                            isThreadRoot: !!r.is_thread,
                            isDirectMessage: !!dmChannel,
                            peer,
                        }))}
                    />
                )
            }}
        />
    )
}

export default SearchPollResults
