import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useFrappeGetCall, useFrappeEventListener } from 'frappe-react-sdk'

import { Message, BaseMessage } from '@raven/types/common/Message'
import { useMessageRowLookups } from '@hooks/useMessageRowLookups'
import { useUserCookieData } from '@hooks/useUserCookieData'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import { MessageResultBlock, RESULT_ROW_ACTIVE_CLASS } from '@components/common/MessageResultBlock/MessageResultBlock'
import type { SelectedNotification } from '@pages/notifications/NotificationChat'
import ErrorBanner from '@components/ui/error-banner'
import _ from '@lib/translate'

interface SavedMessagesListProps {
    searchQuery: string
    channel: string
    /** Selecting a row opens it in the right-pane split view; replaces full-page navigation. */
    onSelect: (selection: SelectedNotification) => void
    /** Open row id — highlights the active row. */
    selectedID?: string
}

/** Row shape returned by raven.api.raven_message.get_saved_messages (v2 API). */
type SavedMessageRow = {
    name: string
    owner: string
    creation: string
    is_thread: 0 | 1
    text?: string
    channel_id: string
    file?: string
    message_type?: BaseMessage['message_type']
    message_reactions?: string
    _liked_by?: string
    workspace?: string
    thumbnail_width?: number
    thumbnail_height?: number
    is_bot_message?: 0 | 1
    bot?: string
    /** Real channel the message (or its thread root) belongs to. */
    parent_channel_id?: string
}

/** Map a saved-message API row to a Message for uniform rendering. */
function savedRowToMessage(r: SavedMessageRow): Message {
    const messageType = r.message_type ?? 'Text'

    const base: BaseMessage = {
        name: r.name,
        owner: r.owner,
        _liked_by: r._liked_by ?? '[]',
        channel_id: r.channel_id,
        creation: r.creation,
        modified: r.creation,
        message_type: messageType,
        is_continuation: 0,
        is_reply: 0,
        is_edited: 0,
        is_forwarded: 0,
        is_thread: 0,
        is_pinned: 0,
    }

    if (messageType === 'File' || messageType === 'Image') {
        return { ...base, message_type: messageType, text: r.text ?? '', file: r.file ?? '' }
    }
    return { ...base, message_type: 'Text', text: r.text ?? '' }
}

type SavedMessagesResponse = { message: SavedMessageRow[] }

const SavedMessagesList = ({ searchQuery, channel, onSelect, selectedID }: SavedMessagesListProps) => {
    const channelParam = channel && channel !== '*all' ? channel : undefined
    const { name: currentUser } = useUserCookieData()

    const { data, error, isLoading, mutate } = useFrappeGetCall<SavedMessagesResponse>(
        'raven.api.raven_message.get_saved_messages',
        undefined,
        undefined,
        { revalidateOnFocus: true },
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

    const results = useMemo(() => {
        const rows = data?.message ?? []
        const query = searchQuery.trim().toLowerCase()
        return rows
            // Match the real channel — thread replies carry a thread-channel id.
            .filter(r => !channelParam || (r.parent_channel_id ?? r.channel_id) === channelParam)
            .filter(r => !query || (r.text ?? '').toLowerCase().includes(query))
            .sort((a, b) => new Date(b.creation).getTime() - new Date(a.creation).getTime())
    }, [data?.message, channelParam, searchQuery])

    if (error) return <ErrorBanner error={error} />
    if (isLoading) return <MessageListSkeleton />
    if (results.length === 0) {
        return (
            <div className="text-sm text-ink-gray-4 text-center py-8">
                {_('No saved messages found.')}
            </div>
        )
    }

    return (
        <Virtuoso
            data={results}
            style={{ height: '100%' }}
            initialItemCount={Math.min(results.length, 10)}
            computeItemKey={(_idx, r) => r.name}
            itemContent={(_idx, r) => {
                // Thread replies live in a thread channel; resolve display against
                // the real (parent) channel so selection carries the routing-ready id.
                const baseChannelId = r.parent_channel_id ?? r.channel_id
                const channelData = channelById.get(baseChannelId)
                const dmChannel = dmById.get(baseChannelId)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <MessageResultBlock
                        message={savedRowToMessage(r)}
                        user={usersById.get(r.owner)}
                        channel={channelData}
                        dmChannel={dmChannel}
                        peer={peer}
                        workspace={channelData?.workspace ? workspaceById.get(channelData.workspace) : undefined}
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

export default SavedMessagesList
