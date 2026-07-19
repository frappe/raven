import { useState } from 'react'
import { Outlet, useMatch, useNavigate, useSearchParams } from 'react-router-dom'
import { useHotkeys } from 'react-hotkeys-hook'
import { Search as SearchIcon, X } from 'lucide-react'

import SearchTabsBar, { SearchTab } from '@components/features/search/SearchTabsBar'
import { SearchFiltersBar } from '@components/features/search/SearchFiltersBar'
import { SearchActiveBadges } from '@components/features/search/SearchActiveBadges'
import SearchMessageResults from '@components/features/search/results/SearchMessageResults'
import SearchFileResults from '@components/features/search/results/SearchFileResults'
import SearchLinkResults from '@components/features/search/results/SearchLinkResults'
import SearchPollResults from '@components/features/search/results/SearchPollResults'
import { NotificationsEmptyState, type SelectedNotification } from '@pages/notifications/NotificationChat'
import AppMobileFooter from '@components/features/header/AppMobileFooter'
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

export default function Search() {
    // All search state lives in URL params so links like /search?q=foo&channel=general work.
    const [searchParams, setSearchParams] = useSearchParams()
    const searchValue = searchParams.get('q') ?? ''

    const setSearchValue = (value: string) => {
        setSearchParams(prev => {
            if (value) prev.set('q', value)
            else prev.delete('q')
            return prev
        }, { replace: true })
    }

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
    const isMobile = useIsMobile()

    // The open result is ROUTE-driven (same as notifications): `/search/:channelID/:messageID`
    // renders NotificationChatRoute in the right pane's Outlet. Being a history entry means
    // the mobile back chevron / OS back-swipe pop to this list, and refresh restores the chat.
    const navigate = useNavigate()
    const selectedMessageID = useMatch("/search/:channelID/:messageID")?.params.messageID
    const hasSelection = !!selectedMessageID

    const onSelect = (selection: SelectedNotification) => {
        navigate(
            {
                pathname: `/search/${encodeURIComponent(selection.channelID)}/${encodeURIComponent(selection.messageID)}`,
                // Keep the query/filters in the URL while the chat is open.
                search: searchParams.toString(),
            },
            {
                // Thread/DM context for the pane — a cold deep-link derives it instead.
                state: {
                    isThread: selection.isThread,
                    isDirectMessage: selection.isDirectMessage,
                    peerID: selection.peer?.name,
                },
                // First open pushes (one back closes the chat); switching between
                // results replaces, so back never walks through every chat viewed.
                replace: hasSelection,
            },
        )
    }

    // Esc closes the open chat — the static right pane falls back to its empty state.
    useHotkeys('esc', () => {
        if (hasSelection) navigate({ pathname: '/search', search: searchParams.toString() })
    }, { enableOnFormTags: true }, [hasSelection, searchParams])

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
                className="pl-9 pr-9 h-9 md:h-8 text-xl md:text-base"
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
        // relative on the OUTER column: the mobile chat layer (absolute inset-0 below)
        // covers list + footer, sliding over the tab bar like a native detail page.
        // The footer stays MOUNTED and is inerted while covered (see AppMobileFooter).
        <div className="relative flex flex-col h-dvh overflow-hidden">
            <div className="flex flex-1 min-h-0 flex-row overflow-hidden">
                {/* Left pane: full width on mobile (the open chat covers it as a layer);
                    pinned at 45% on desktop beside the static chat pane — mirrors the
                    threads / notifications split. */}
                <div
                    className="relative flex flex-col overflow-hidden min-w-0 w-full md:w-[45%] md:max-w-[50%] md:shrink-0 bg-surface-base md:bg-surface-sidebar"
                    // While covered by the mobile chat layer, keep the list out of
                    // focus / accessibility order.
                    inert={isMobile && hasSelection ? true : undefined}
                >
                    <PageHeader title={_('Search')} />
                    <div className="shrink-0">
                        {/* p-2 + space-y-3 mirrors the threads page so the search-bar → tabs → list
                            spacing is identical across pages. */}
                        <div className="mx-auto w-full p-2 pb-0 space-y-3">
                            {searchInput}
                            {/* Wrapper is the space-y child; it absorbs the inner row's -my-1 so the
                                gaps stay 12px (the -my would otherwise shrink them). The inner row is
                                tabs + filters: one row (nowrap) that scrolls horizontally at odd/narrow
                                resolutions (the list pane is only 45% wide). py-1 -my-1 gives the filter
                                button's floating count badge clip room (overflow-x-auto forces overflow-y
                                to clip) while netting the row's box to zero — row height is unchanged. */}
                            <div>
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:py-1 md:-my-1 md:flex-nowrap md:overflow-x-auto md:min-w-0">
                                    <SearchTabsBar activeTab={activeTab} setActiveTab={onTabChange} fullWidth={isMobile} />
                                    {/* min-w-0: the browser over-estimates this wrapper's automatic
                                        minimum by a few px, which forced a tiny horizontal scroll when
                                        the clear-X appears. With it the selects flex down to their
                                        min-w floors first; past the floors content overflows into the
                                        row's scroll — the floors still hold, so the fallback stays. */}
                                    <div className="md:ml-auto md:min-w-0">
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
                                    {activeTab === 'messages' && <SearchMessageResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                    {activeTab === 'files' && <SearchFileResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                    {activeTab === 'links' && <SearchLinkResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                    {activeTab === 'polls' && <SearchPollResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right pane: static on desktop — empty state until a result is selected
                    (mirrors threads / notifications). On mobile it's a full-screen layer over
                    list + tab bar (inset-0 of the OUTER column) while a result is open, so the
                    list underneath keeps its scroll position. */}
                <div className={cn(
                    "flex flex-col min-w-0 min-h-0 bg-surface-gray-1",
                    "max-md:absolute max-md:inset-0 max-md:z-20 animate-layer-in",
                    !hasSelection && "max-md:hidden",
                    "md:flex-1",
                )}>
                    {hasSelection
                        ? <Outlet />
                        : <NotificationsEmptyState message={_("Select a result to view the message.")} />}
                </div>
            </div>
            <AppMobileFooter inert={isMobile && hasSelection ? true : undefined} />
        </div>
    )
}
