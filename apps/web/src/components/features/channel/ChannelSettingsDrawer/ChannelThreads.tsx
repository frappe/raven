import { UserAvatar } from '@components/features/message/UserAvatar'
import { MessageSquareText, Search, SearchIcon } from 'lucide-react'
import { useDebounceValue } from 'usehooks-ts'
import _ from '@lib/translate'
import { useSqliteSearch } from '@hooks/useSqliteSearch'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import { useChannelMembers } from '@hooks/useChannelMembers'
import { formatRelativeDate } from '@lib/date'
import MarkdownRenderer from '@components/ui/markdown'
import ErrorBanner from '@components/ui/error-banner'
import { Input } from '@components/ui/input'
import { TAB_SCROLLER } from './tabPanel'
import { InputGroup, InputGroupAddon } from '@components/ui/input-group'

const ChannelThreads = ({ channelID }: { channelID: string }) => {

    // Debounced at the INPUT (uncontrolled below): keystrokes render nothing;
    // the tab re-renders once per settled query. The search hooks no longer
    // debounce internally — this is the one debounce.
    const [searchQuery, setSearchQuery] = useDebounceValue('', 200)
    const { members } = useChannelMembers(channelID)

    const { results, isLoading, error } = useSqliteSearch(searchQuery, {
        channel_id: channelID,
        is_thread: 1
    }, 100)


    return (
        // Flex column: the search bar stays pinned; only the list below scrolls.
        <div className="flex flex-1 min-h-0 flex-col gap-3">
            {/* Search Bar */}
            <InputGroup>
                <InputGroupAddon>
                    <SearchIcon />
                </InputGroupAddon>
                <Input
                    inputSize="sm"
                    placeholder={_("Search...")}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </InputGroup>
            {error && <ErrorBanner error={error} />}
            {/* Threads List — the tab's one scroller (fade + safe-area padding). */}
            <div className={TAB_SCROLLER}>
                {isLoading || !results ? <MessageListSkeleton /> :
                    results.length === 0 ? <div className="text-p-sm text-ink-gray-4 text-center py-8">{searchQuery ? _("No threads found matching your search.") : _("No threads in this channel yet.")}</div> :
                        <div className="space-y-2 pb-1">
                            {results.map((thread) => {
                                const member = members.find((m) => m.name === thread.author)
                                return (
                                    <div
                                        key={thread.id}
                                        className="group p-3 border border-outline-gray-1 rounded-md hover:bg-surface-gray-1 transition-colors cursor-pointer w-full"
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Open thread: ${thread.content}`}>
                                        <div className="flex items-start justify-between gap-3 mb-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <h3 className="text-p-sm text-ink-gray-8 truncate">
                                                    <MarkdownRenderer content={thread.content} />
                                                </h3>
                                            </div>
                                            {/* {thread.reply_count ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                                    {thread.reply_count > 9 ? '9+' : thread.reply_count}
                                                </Badge>
                                            ) : null} */}
                                        </div>

                                        {/* <div className="text-sm mb-2 line-clamp-2">
                                            {channel?.last_message_details?.content}
                                        </div> */}

                                        <div className="flex items-center gap-2 text-xs leading-nug text-ink-gray-5 pt-1">
                                            {member && <><UserAvatar
                                                user={member}
                                                size="xs"
                                                // fontSize="xs"
                                                // radius="full"
                                                showStatusIndicator={false}
                                            />
                                                <span>{member.full_name}</span>
                                                <span>•</span></>}
                                            <span>{formatRelativeDate(thread.creation)}</span>
                                        </div>
                                    </div>)
                            }
                            )}
                        </div>}
            </div>
        </div>
    )
}

export default ChannelThreads