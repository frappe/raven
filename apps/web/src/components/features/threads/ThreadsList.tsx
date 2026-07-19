import { memo, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { Virtuoso } from "react-virtuoso"
import { UserData } from "@db"
import { ThreadPreviewBox } from "./ThreadPreviewBox"
import { ThreadMessage } from "src/types/ThreadMessage"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { useMessageRowLookups } from "@hooks/useMessageRowLookups"
import { useChannelMembers } from "@hooks/useChannelMembers"
import { ScrollViewportContext, useHasBeenInView } from "@hooks/useHasBeenInView"
import { useThreadList } from "@stores/threads/useThreadList"
import { loadThreadDetails, useThreadReplyCount } from "@stores/threads/useThreadMeta"
import type { ThreadRowData } from "@stores/threads/listSelectors"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@components/ui/empty"
import { Bot, CheckCheck, MessagesSquare, Search, TriangleAlert } from "lucide-react"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import _ from "@lib/translate"

interface ThreadsListProps {
    threadType?: "participating" | "other" | "ai"
    searchQuery?: string
    channelFilter?: string
    onlyShowUnread?: boolean
    onThreadClick?: (thread: ThreadMessage) => void
    /** Active thread ID */
    activeThreadID?: string
}

export type ThreadChannelDetails = {
    channelName?: string
    channelIcon?: React.ReactNode
    isDirectMessage?: boolean
    participants: UserData[]
}

type RowLookups = {
    usersById: Map<string, UserData>
    channelById: Map<string, ChannelListItem>
    dmById: Map<string, DMChannelListItem>
}

/** Module-level Footer so Virtuoso's component types stay stable across renders. */
type ListContext = { isLoadingMore: boolean }
const ListFooter = ({ context }: { context?: ListContext }) => (
    <>
        {context?.isLoadingMore && (
            <div className="py-4 text-center text-xs text-ink-gray-4">{_("Loading more threads...")}</div>
        )}
        {/* Mobile: small breathing pad above the tab bar. */}
        <div className="h-2 md:h-0" aria-hidden="true" />
    </>
)
const listComponents = { Footer: ListFooter }

/** Centers the empty state over the whole left column (absolute) so it lands at the same height
 *  as the thread pane's empty state, not offset below the search/tabs/filter stack. Relies on the
 *  list column in Threads.tsx being `relative`. pointer-events-none keeps the toolbar clickable. */
const EmptyOverlay = ({ children }: { children: ReactNode }) => (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {children}
    </div>
)

const ThreadRow = memo(function ThreadRow({
    thread,
    lookups,
    onSelect,
    isActive,
}: {
    thread: ThreadRowData
    lookups: RowLookups
    /** Stable selection handler; bound to this row's thread internally so the row's
     *  onClick identity stays stable and the memo only re-renders on real prop changes. */
    onSelect?: (thread: ThreadRowData) => void
    isActive?: boolean
}) {
    // Unread flag is baked into the row data (see selectThreadRows): the row object's
    // identity changes when it flips, so this memo'd row re-renders exactly then.
    const isUnread = thread._isUnread
    const { usersById, channelById, dmById } = lookups
    const onClick = useCallback(() => onSelect?.(thread), [onSelect, thread])

    const dmChannel = dmById.get(thread.channel_id)
    const channel = channelById.get(thread.channel_id)
    const peer = dmChannel?.peer_user_id ? usersById.get(dmChannel.peer_user_id) : undefined
    const user = usersById.get(thread.owner) ?? null

    // Members + reply count come from the stores, lazily. A regular channel thread fetches its
    // details (members + count) ONCE the row actually scrolls into view — gated on
    // useHasBeenInView (not mere mount), because Virtuoso mounts more rows than are visible, so
    // mount-gating would over-fetch the whole first page. Warms the same stores the thread pill
    // + detail use (and loadThreadDetails self-dedupes, so a thread already loaded by a channel
    // pill isn't refetched). DM/AI threads derive their avatar from the peer/bot — no fetch.
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { ref: inViewRef, hasBeenInView } = useHasBeenInView({ rootMargin: "200px" })
    const isChannelThread = thread.is_dm_thread !== 1 && thread.is_ai_thread !== 1
    useEffect(() => {
        if (isChannelThread && hasBeenInView) loadThreadDetails(call, thread.name)
    }, [call, thread.name, isChannelThread, hasBeenInView])

    // Members from the store (seeded by loadThreadDetails, kept live by channel_members_updated).
    const { members } = useChannelMembers(thread.name, { autoFetch: false })
    // Count from threadMetaStore (live via thread_reply); falls back to the row's fetch-time
    // value until this row's details land.
    const replyCount = useThreadReplyCount(thread.name) ?? thread.reply_count

    const channelDetails: ThreadChannelDetails = useMemo(() => {
        if (thread.is_dm_thread === 1) {
            return {
                channelName: `DM with ${peer?.full_name ?? dmChannel?.peer_user_id ?? _("Unknown")}`,
                channelIcon: undefined,
                isDirectMessage: true,
                participants: peer ? [peer] : [],
            }
        } else if (channel) {
            return {
                channelName: channel.channel_name || channel.name,
                channelIcon: (
                    <ChannelIcon type={channel.type as "Public" | "Private" | "Open"} className="h-3.5 w-3.5" />
                ),
                isDirectMessage: false,
                participants: members,
            }
        }
        return { channelName: undefined, channelIcon: undefined, isDirectMessage: false, participants: [] }
    }, [channel, dmChannel, members, thread.is_dm_thread, peer])

    return (
        <div ref={inViewRef}>
            <ThreadPreviewBox
                user={user}
                isUnread={isUnread}
                thread={thread}
                replyCount={replyCount}
                channelDetails={channelDetails}
                onClick={onClick}
                isActive={isActive}
            />
        </div>
    )
})

export default function ThreadsList({
    threadType = "participating",
    searchQuery,
    channelFilter,
    onlyShowUnread = false,
    onThreadClick,
    activeThreadID,
}: ThreadsListProps) {
    const { rows, isLoading, error, hasMore, loadMore } = useThreadList(threadType, {
        channel: channelFilter,
        onlyShowUnread,
        search: searchQuery ?? "",
    })

    const [scroller, setScroller] = useState<HTMLElement | null>(null)

    const { usersById, channelById, dmById } = useMessageRowLookups()
    const lookups = useMemo<RowLookups>(
        () => ({ usersById, channelById, dmById }),
        [usersById, channelById, dmById],
    )

    const endReached = useCallback(() => {
        if (hasMore) loadMore()
    }, [hasMore, loadMore])

    // Stable context object so Virtuoso doesn't treat every parent render as a context change.
    const listContext = useMemo<ListContext>(
        () => ({ isLoadingMore: hasMore && isLoading }),
        [hasMore, isLoading],
    )

    if (error) {
        return (
            <EmptyOverlay>
                <Empty>
                    <EmptyMedia><TriangleAlert /></EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>{_("Couldn't load threads")}</EmptyTitle>
                        <EmptyDescription>{error}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </EmptyOverlay>
        )
    }
    if (isLoading && rows.length === 0) return <MessageListSkeleton />

    if (rows.length === 0) {
        if (searchQuery?.trim()) {
            return (
                <EmptyOverlay>
                    <Empty>
                        <EmptyMedia><Search /></EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle>{_("No matching threads")}</EmptyTitle>
                            <EmptyDescription>{_("Try a different search term.")}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </EmptyOverlay>
            )
        }
        return (
            <EmptyOverlay>
                <Empty>
                    <EmptyMedia>
                        {onlyShowUnread ? <CheckCheck /> : threadType === "ai" ? <Bot /> : <MessagesSquare />}
                    </EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>{onlyShowUnread ? _("You're all caught up") : _("No threads yet")}</EmptyTitle>
                        <EmptyDescription>
                            {onlyShowUnread
                                ? _("There are no unread threads to show. Clear the filter to see all threads.")
                                : threadType === "ai"
                                  ? _("AI threads will appear here when you start conversations with an AI bot.")
                                  : _("Create a thread by right-clicking a message and selecting 'Create Thread'.")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </EmptyOverlay>
        )
    }

    return (
        // Root in-view detection at Virtuoso's scroll container so a row fetches its details
        // only when it's actually near-visible — Virtuoso mounts more rows than are on screen,
        // so gating on mount would over-fetch (see ThreadRow).
        <ScrollViewportContext.Provider value={scroller}>
            <Virtuoso
                data={rows}
                style={{ height: "100%" }}
                scrollerRef={(ref) => setScroller(ref as HTMLElement | null)}
                endReached={endReached}
                overscan={200}
                defaultItemHeight={140}
                context={listContext}
                components={listComponents}
                computeItemKey={(index, thread) => thread?.name ?? index}
                // Rows can shrink between renders (search/filter apply per keystroke) while
                // Virtuoso still holds the old index range — skip the out-of-range frame.
                itemContent={(_index, thread) => thread ? (
                    <ThreadRow
                        thread={thread}
                        lookups={lookups}
                        onSelect={onThreadClick}
                        isActive={activeThreadID === thread.name}
                    />
                ) : null}
            />
        </ScrollViewportContext.Provider>
    )
}
