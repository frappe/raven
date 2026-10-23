import { useEffect, useState } from 'react'
import { voicePlaybackStore } from '@stores/voicePlayback/store'
import { Virtuoso } from 'react-virtuoso'
import { useFrappeGetCall, useFrappeEventListener } from 'frappe-react-sdk'

import { Message, BaseMessage } from '@raven/types/common/Message'
import { useMessageRowLookups } from '@hooks/useMessageRowLookups'
import { useUserCookieData } from '@hooks/useUserCookieData'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import { MessageResultBlock, RESULT_ROW_ACTIVE_CLASS } from '@components/common/MessageResultBlock/MessageResultBlock'
import { savedRowToMessage, type SavedMessageRow } from './savedRowToMessage'
import { searchResultToSelection } from '@components/common/MessageResultBlock/searchResultToSelection'
import type { SelectedNotification } from '@pages/notifications/NotificationChat'
import ErrorBanner from '@components/ui/error-banner'
import { Bookmark } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@components/ui/empty'
import _ from '@lib/translate'
import { getMessageAuthorId } from '@utils/messageUtils'

interface SavedMessagesListProps {
    searchQuery: string
    channel: string
    /** Selecting a row opens it in the right-pane split view; replaces full-page navigation. */
    onSelect: (selection: SelectedNotification) => void
    /** Open row id — highlights the active row. */
    selectedID?: string
}

/** Row shape returned by raven.api.raven_message.get_saved_messages (v2 API). */


type SavedMessagesResponse = { message: SavedMessageRow[] }

/** Server page size; scrolling to the end grows the window by another page. */
const PAGE_SIZE = 50

const SavedMessagesList = ({ searchQuery, channel, onSelect, selectedID }: SavedMessagesListProps) => {
    // Leaving the list stops its voice notes; they start over next time.
    useEffect(() => () => voicePlaybackStore.stopAll(), [])
    const channelParam = channel && channel !== '*all' ? channel : undefined
    const { name: currentUser } = useUserCookieData()

    // Search + channel filter run SERVER-side (the list is paginated — a client
    // filter would only see loaded pages). Debounce typing before hitting the API.
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(searchQuery), 300)
        return () => window.clearTimeout(timer)
    }, [searchQuery])

    const [pages, setPages] = useState(1)
    // New filter = new list — restart the window.
    useEffect(() => setPages(1), [debouncedSearch, channelParam])

    const limit = pages * PAGE_SIZE
    const { data, error, isLoading, mutate } = useFrappeGetCall<SavedMessagesResponse>(
        'raven.api.raven_message.get_saved_messages',
        {
            limit,
            start: 0,
            search: debouncedSearch.trim() || undefined,
            channel_id: channelParam,
        },
        undefined,
        // keepPreviousData: page growth / filter changes swap data in place
        // instead of flashing the skeleton.
        { revalidateOnFocus: true, keepPreviousData: true },
    )

    // Live reflection of save/unsave done anywhere (the event is user-scoped). Saving is
    // infrequent, so this stays lightweight: drop the row on unsave with no refetch; on a
    // new save, revalidate once to pull the row. `revalidateOnFocus` is the drift backstop.
    useFrappeEventListener('message_saved', (event: { channel_id: string; message_id: string; liked_by: string }) => {
        const stillSaved = (JSON.parse(event.liked_by || '[]') as string[]).includes(currentUser)
        if (!stillSaved) {
            mutate(
                (prev) => prev && { message: prev.message.filter((r) => r.name !== event.message_id) },
                { revalidate: false },
            )
        } else {
            mutate()
        }
    })

    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    // Server returns the filtered window newest-first; a full page means more may exist.
    const results = data?.message ?? []
    const hasMore = results.length === limit

    if (error) return <div className="p-3"><ErrorBanner error={error} /></div>
    if (isLoading) return <MessageListSkeleton />
    if (results.length === 0) {
        // Absolute overlay centers over the whole pane (the Later left pane is `relative`),
        // matching the notifications / threads / search empty states.
        return (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Empty>
                    <EmptyMedia><Bookmark /></EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>{_('No saved messages')}</EmptyTitle>
                        <EmptyDescription>{_('Save a message to find it here, or adjust your search.')}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        )
    }

    return (
        <Virtuoso
            data={results}
            style={{ height: '100%' }}
            initialItemCount={Math.min(results.length, 10)}
            endReached={() => hasMore && setPages((p) => p + 1)}
            computeItemKey={(idx, r) => r?.name ?? idx}
            itemContent={(_idx, r) => {
                // Results can shrink between renders (search/channel filters apply per
                // keystroke) while Virtuoso still holds the old index range — skip the
                // out-of-range frame; the next render drops the row.
                if (!r) return null
                // Display only: thread replies live in a thread channel, so name/workspace
                // lookups resolve against the real (parent) channel. Routing is handled
                // separately by searchResultToSelection.
                const baseChannelId = r.parent_channel_id ?? r.channel_id
                const channelData = channelById.get(baseChannelId)
                const dmChannel = dmById.get(baseChannelId)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <MessageResultBlock
                        message={savedRowToMessage(r)}
                        user={usersById.get(getMessageAuthorId(r, r.owner))}
                        channel={channelData}
                        dmChannel={dmChannel}
                        peer={peer}
                        workspace={channelData?.workspace ? workspaceById.get(channelData.workspace) : undefined}
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

export default SavedMessagesList
