import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, useMatch, useNavigate, useSearchParams } from 'react-router-dom'
import { useDebounceValue } from 'usehooks-ts'
import { useEscHotkey } from '@hooks/useEscHotkey'
import { ListFilter, Search as SearchIcon, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@components/ui/drawer'

import SearchTabsBar, { SearchTab } from '@components/features/search/SearchTabsBar'
import { SearchFiltersBar } from '@components/features/search/SearchFiltersBar'
import { SearchFiltersSheet } from '@components/features/search/SearchFiltersSheet'
import { SearchActiveBadges } from '@components/features/search/SearchActiveBadges'
import SearchMessageResults from '@components/features/search/results/SearchMessageResults'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'

// Messages is the landing tab, so its results stay in the page's own chunk —
// the other tabs' renderers load on first visit to that tab. Their chunks are
// tiny individually, but each pulls its own preview machinery (file previews,
// poll cards), and most searches never leave the messages tab.
const SearchFileResults = lazy(() => import('@components/features/search/results/SearchFileResults'))
const SearchLinkResults = lazy(() => import('@components/features/search/results/SearchLinkResults'))
const SearchPollResults = lazy(() => import('@components/features/search/results/SearchPollResults'))
import { NotificationsEmptyState, type SelectedNotification } from '@pages/notifications/NotificationChat'
import AppMobileFooter from '@components/features/header/AppMobileFooter'
import { PageHeader } from '@components/layout/PageHeader'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@components/ui/empty'
import { SearchFilters } from '@components/features/search/types'

import { useChannelList } from "@stores/channels/useChannelList"
import { useUsers } from '@hooks/useUsers'
import { Input } from '@components/ui/input'
import { Button } from '@components/ui/button'
import { useIsMobile } from '@hooks/use-mobile'
import { useLayerInAnimation } from "@hooks/useLayerInAnimation"
import { cn } from '@lib/utils'
import _ from '@lib/translate'
import { InputGroup, InputGroupAddon, InputGroupButton } from '@components/ui/input-group'

export default function Search() {
    // All search state lives in URL params so links like /search?q=foo&channel=general work.
    const [searchParams, setSearchParams] = useSearchParams()
    const searchValue = searchParams.get('q') ?? ''

    // The ONE debounce for all result tabs (the search hooks don't debounce
    // internally anymore). The URL is the source of truth and updates per
    // keystroke by design (deep-linkable state), so this page re-renders per
    // keystroke regardless — the debounce here is about not FETCHING per
    // keystroke. Synced from the URL value via effect because useDebounceValue
    // doesn't track its initial value.
    const [debouncedQuery, setDebouncedQuery] = useDebounceValue(searchValue, 200)
    useEffect(() => {
        setDebouncedQuery(searchValue)
    }, [searchValue, setDebouncedQuery])

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
    const linkProviderFromURL = searchParams.get('link_provider')?.split(',').filter(Boolean) ?? []
    const tabFromURL = (searchParams.get('tab') as SearchTab) || 'messages'

    const [activeTab, setActiveTab] = useState<SearchTab>(tabFromURL)
    const isMobile = useIsMobile()

    // How many filter CONTROLS are active — the dot on the filter button.
    // A deep link that arrives with filters needs no auto-open anymore:
    // the badge row below the tabs already explains the results.
    const activeFilterCount =
        (channelFromURL ? 1 : 0) +
        (userFromURL ? 1 : 0) +
        (fileTypeFromURL.length > 0 ? 1 : 0) +
        (linkProviderFromURL.length > 0 ? 1 : 0)

    // The open result is ROUTE-driven (same as notifications): `/search/:channelID/:messageID`
    // renders NotificationChatRoute in the right pane's Outlet. Being a history entry means
    // the mobile back chevron / OS back-swipe pop to this list, and refresh restores the chat.
    const navigate = useNavigate()
    const selectedMessageID = useMatch("/search/:channelID/:messageID")?.params.messageID
    const hasSelection = !!selectedMessageID
    // No slide when the chat layer is already open on a BACK arrival — see the hook.
    const layerAnimation = useLayerInAnimation(hasSelection)

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
    useEscHotkey(() => {
        if (hasSelection) navigate({ pathname: '/search', search: searchParams.toString() })
    }, { enableOnFormTags: true }, [hasSelection, searchParams])

    const filters: SearchFilters = {
        query: debouncedQuery || '',
        channel_id: channelFromURL,
        owner: userFromURL,
        file_type: fileTypeFromURL,
        link_provider: linkProviderFromURL,
    }

    const { channels, dmChannels } = useChannelList()
    const users = useUsers()

    // Don't fetch until there's something to search for — an empty query with no filters would
    // otherwise pull the whole corpus. Gating the render here means the result components (and
    // their fetch hooks) never mount, so no request fires.
    const hasActiveSearch =
        (filters.query ?? '').trim().length > 0 ||
        !!filters.channel_id ||
        !!filters.owner ||
        (filters.file_type?.length ?? 0) > 0 ||
        (filters.link_provider?.length ?? 0) > 0

    const onTabChange = (tab: SearchTab) => {
        setActiveTab(tab)
        setSearchParams((prev) => {
            prev.set('tab', tab)
            // Tab-scoped filters leave with their tab. They only ever
            // narrowed their own tab's results, but their badges lingered
            // on every tab — reading like a filter that isn't filtering.
            if (tab !== 'files') prev.delete('file_type')
            if (tab !== 'links') prev.delete('link_provider')
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

    const setFileTypeFilter = (fileTypes: string[]) => {
        setSearchParams((prev) => {
            if (fileTypes.length) prev.set('file_type', fileTypes.join(','))
            else prev.delete('file_type')
            return prev
        }, { replace: true })
    }

    const setProviderFilter = (providers: string[]) => {
        setSearchParams((prev) => {
            if (providers.length) prev.set('link_provider', providers.join(','))
            else prev.delete('link_provider')
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

    // Shared between the desktop popover and the mobile drawer, so the two
    // surfaces can never drift apart in what they offer.
    const filterButton = (
        <Button
            variant="subtle"
            size="md"
            aria-label={_('Filters')}
            className="relative shrink-0"
        >
            <ListFilter />
            {_("Filters")}
            {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-gray-10 px-1 text-[10px] leading-none text-ink-gray-1">
                    {activeFilterCount}
                </span>
            )}
        </Button>
    )

    const filtersPanel = (
        <SearchFiltersBar
            filters={filters}
            channels={channels}
            dmChannels={dmChannels}
            onChannelChange={setChannelFilter}
            onUserChange={setUserFilter}
            onFileTypeChange={setFileTypeFilter}
            onProviderChange={setProviderFilter}
            showFileTypeFilter={activeTab === 'files'}
            showProviderFilter={activeTab === 'links'}
        />
    )

    const searchInput = (
        <div className="flex items-center gap-2">
            <InputGroup className='pr-0.5'>
                <InputGroupAddon>
                    <SearchIcon className="h-4 w-4 text-ink-gray-4 pointer-events-none" />
                </InputGroupAddon>
                <Input
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={_('Type to search')}
                    // className="pl-9 pr-9 h-9 md:h-8 text-xl md:text-base"
                    autoFocus={!isMobile}
                />
                {searchValue && <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        variant="ghost"
                        size="icon-xs"
                        isIconButton
                        onClick={() => setSearchValue('')}
                        aria-label={_('Clear search')}
                        className="rounded-full"
                    >
                        <X />
                    </InputGroupButton>
                </InputGroupAddon>}
            </InputGroup>
            {/* Filters live behind this button — no filter row on the page.
                The active-filter badges below the tabs stay as the persistent
                trace of what's on; the dot here just says "something is".
                Desktop anchors a popover to the button; mobile gets a bottom
                drawer — a floating panel is fiddly under a thumb. */}
            {isMobile ? (
                <Drawer>
                    <DrawerTrigger asChild>{filterButton}</DrawerTrigger>
                    <DrawerContent className="max-h-[85dvh]">
                        <DrawerTitle className="px-4 pb-3 pt-1 text-left text-2xl-semibold text-ink-gray-9">
                            {_('Filters')}
                        </DrawerTitle>
<DrawerDescription className="sr-only">{_("Narrow results by person, channel, type or source")}</DrawerDescription>
                        {/* Not the desktop combobox stack: drill-in rows for the
                            searchable lists, inline chips for the bounded ones. */}
                        <SearchFiltersSheet
                            filters={filters}
                            channels={channels}
                            dmChannels={dmChannels}
                            onChannelChange={setChannelFilter}
                            onUserChange={setUserFilter}
                            onFileTypeChange={setFileTypeFilter}
                            onProviderChange={setProviderFilter}
                            showFileTypeFilter={activeTab === 'files'}
                            showProviderFilter={activeTab === 'links'}
                        />
                    </DrawerContent>
                </Drawer>
            ) : (
                <Popover>
                    <PopoverTrigger asChild>{filterButton}</PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-3">
                        {filtersPanel}
                    </PopoverContent>
                </Popover>
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
                            <SearchTabsBar activeTab={activeTab} setActiveTab={onTabChange} />
                            <SearchActiveBadges
                                filters={filters}
                                channels={channels}
                                dmChannels={dmChannels}
                                users={users}
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

                    {/* No horizontal gutter on mobile — result rows own their
                        padding, so lists run flush to the screen edges. */}
                    <div className="flex-1 min-h-0 pb-2">
                        <div className="mx-auto w-full h-full">
                            {hasActiveSearch && (
                                <>
                                    {activeTab === 'messages' && <SearchMessageResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                    {/* Tab switches are plain state updates (not router
                                        transitions), so a first visit to a lazy tab shows
                                        this skeleton while its chunk loads — same rows the
                                        results themselves show while fetching. */}
                                    <Suspense fallback={<MessageListSkeleton />}>
                                        {activeTab === 'files' && <SearchFileResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                        {activeTab === 'links' && <SearchLinkResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                        {activeTab === 'polls' && <SearchPollResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                    </Suspense>
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
                    "max-md:absolute max-md:inset-0 max-md:z-20",
                    layerAnimation,
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
