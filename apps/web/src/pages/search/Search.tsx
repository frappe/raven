import { useCallback, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useHotkeys } from 'react-hotkeys-hook'
import { Search as SearchIcon, X } from 'lucide-react'

import SearchTabsBar, { SearchTab } from '@components/features/search/SearchTabsBar'
import { SearchFiltersBar } from '@components/features/search/SearchFiltersBar'
import { SearchActiveBadges } from '@components/features/search/SearchActiveBadges'
import SearchMessageResults from '@components/features/search/results/SearchMessageResults'
import SearchFileResults from '@components/features/search/results/SearchFileResults'
import SearchLinkResults from '@components/features/search/results/SearchLinkResults'
import SearchPollResults from '@components/features/search/results/SearchPollResults'
import NotificationChat, { type SelectedNotification } from '@pages/notifications/NotificationChat'
import { PageHeader } from '@components/layout/PageHeader'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@components/ui/empty'
import { SearchFilters } from '@components/features/search/types'

import { useChannelList } from "@stores/channels/useChannelList"
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@db'
import { Input } from '@components/ui/input'
import { useIsMobile } from '@hooks/use-mobile'
import { cn } from '@lib/utils'
import _ from '@lib/translate'

interface SearchOutletContext {
    searchValue: string
    setSearchValue: (v: string) => void
}

export default function Search() {
    const { searchValue, setSearchValue } = useOutletContext<SearchOutletContext>()
    const [searchParams, setSearchParams] = useSearchParams()

    const channelFromURL = searchParams.get('channel') ?? ''
    const userFromURL = searchParams.get('user') ?? ''
    const fileTypeFromURL = searchParams.get('file_type')?.split(',').filter(Boolean) ?? []
    const channelTypeFromURL = searchParams.get('channel_type') ?? ''
    const isDMFromURL = searchParams.get('is_dm') ? 1 : null
    const excludeDMs = channelTypeFromURL === 'Private' ? 0 : null
    const isThreadMessageFromURL = searchParams.get('is_thread_message') ? 1 : null
    const savedFromURL = searchParams.get('saved') ? 1 : null
    const isPinnedFromURL = searchParams.get('is_pinned') ? 1 : null
    const hasReactionsFromURL = searchParams.get('has_reactions') ? 1 : null
    const mentionsMeFromURL = searchParams.get('mentions_me') ? 1 : null
    const tabFromURL = (searchParams.get('tab') as SearchTab) || 'messages'

    const [activeTab, setActiveTab] = useState<SearchTab>(tabFromURL)
    const [selected, setSelected] = useState<SelectedNotification | null>(null)
    const hasSelection = !!selected
    const isMobile = useIsMobile()

    // Clicking the open row again collapses the pane back to a full-width list.
    const onSelect = useCallback((selection: SelectedNotification) => {
        setSelected(prev => prev?.messageID === selection.messageID ? null : selection)
    }, [])

    // Esc closes the pane (no visible close button — toggle the row or hit Esc).
    useHotkeys('esc', () => setSelected(null), { enableOnFormTags: true }, [])

    const filters: SearchFilters = {
        query: searchValue || '',
        channel_id: channelFromURL,
        owner: userFromURL,
        file_type: fileTypeFromURL,
        channel_type: channelTypeFromURL,
        is_direct_message: isDMFromURL ?? excludeDMs,
        saved: savedFromURL,
        is_pinned: isPinnedFromURL,
        is_thread: null,
        is_thread_message: isThreadMessageFromURL,
        is_bot_message: null,
        has_reactions: hasReactionsFromURL,
        mentions_me: mentionsMeFromURL,
    }

    const { channels, dmChannels } = useChannelList()
    const users = useLiveQuery(() => db.users.toArray(), [])

    // Don't fetch until there's something to search for — an empty query with no filters would
    // otherwise pull the whole corpus. Gating the render here means the result components (and
    // their fetch hooks) never mount, so no request fires.
    const hasActiveSearch =
        (filters.query ?? '').trim().length > 0 ||
        !!filters.channel_id ||
        !!filters.owner ||
        (filters.file_type?.length ?? 0) > 0 ||
        !!filters.channel_type ||
        filters.is_direct_message != null ||
        filters.saved != null ||
        filters.is_pinned != null ||
        filters.is_thread_message != null ||
        filters.has_reactions != null ||
        filters.mentions_me != null

    const onTabChange = (tab: SearchTab) => {
        setActiveTab(tab)
        setSearchParams((prev) => {
            prev.set('tab', tab)
            return prev
        }, { replace: true })
    }

    const setChannelFilter = (channelId: string) => {
        setSearchParams((prev) => {
            if (channelId !== '*all') prev.set('channel', channelId)
            else prev.delete('channel')
            return prev
        }, { replace: true })
    }

    const setUserFilter = (userId: string) => {
        setSearchParams((prev) => {
            if (userId && userId !== 'all') prev.set('user', userId)
            else prev.delete('user')
            return prev
        }, { replace: true })
    }

    const searchInput = (
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4 pointer-events-none" />
            <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={_('Search messages, files, links, polls')}
                className={cn("pl-9 pr-9 h-9 md:h-8 text-xl md:text-base",
                    hasSelection && "bg-surface-gray-3 hover:bg-surface-gray-4"
                )}
                autoFocus
            />
            {searchValue && (
                <button
                    type="button"
                    onClick={() => setSearchValue('')}
                    aria-label={_('Clear search')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-gray-4 hover:text-ink-gray-8"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    )


    return (
        <div className={cn(
            "flex flex-row h-full overflow-hidden",
            hasSelection && "bg-surface-gray-1"
        )}>
            {/* Left pane: full width by default; exact half once a result is selected (no divider —
                the right pane's gray canvas separates them). On mobile a selection takes over the
                whole screen, so the list pane is hidden (mirrors the notifications page). */}
            <div className={cn(
                "relative flex flex-col overflow-hidden min-w-0",
                hasSelection ? "w-1/2 shrink-0" : "flex-1",
                isMobile && hasSelection && "hidden"
            )}>
                <PageHeader title={_('Search')} />
                <div className="shrink-0">
                    <div className="mx-auto w-full px-2 pt-2 space-y-2">
                        {searchInput}
                        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
                            <SearchTabsBar activeTab={activeTab} setActiveTab={onTabChange} fullWidth={isMobile} />
                            <div className="md:ml-auto">
                                <SearchFiltersBar
                                    filters={filters}
                                    channels={channels}
                                    dmChannels={dmChannels}
                                    onChannelChange={setChannelFilter}
                                    onUserChange={setUserFilter}
                                    isMobile={isMobile}
                                />
                            </div>
                        </div>
                        <SearchActiveBadges
                            filters={filters}
                            channels={channels}
                            dmChannels={dmChannels}
                            users={users ?? []}
                        />
                    </div>
                </div>

                {/* Empty prompt centers over the whole pane (absolute) so it lands at the same
                    height as the right pane's empty state, not offset below the header/tabs/filters.
                    pointer-events-none keeps the search input + filters clickable underneath. */}
                {!hasActiveSearch && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <Empty>
                            <EmptyMedia><SearchIcon /></EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>{_('Search Raven')}</EmptyTitle>
                                <EmptyDescription>{_('Find messages, files, links and polls. Type a query or pick a filter to start.')}</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </div>
                )}

                <div className="flex-1 min-h-0 px-3 md:px-0 pb-2">
                    <div className="mx-auto w-full h-full">
                        {hasActiveSearch && (
                            <>
                                {activeTab === 'messages' && <SearchMessageResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selected?.messageID} />}
                                {activeTab === 'files' && <SearchFileResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selected?.messageID} />}
                                {activeTab === 'links' && <SearchLinkResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selected?.messageID} />}
                                {activeTab === 'polls' && <SearchPollResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selected?.messageID} />}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {selected && (
                <div className={cn(
                    "shrink-0 flex flex-col min-h-0 bg-surface-gray-0",
                    isMobile ? "w-full" : "w-1/2"
                )}>
                    <NotificationChat selected={selected} />
                </div>
            )}
        </div>
    )
}
