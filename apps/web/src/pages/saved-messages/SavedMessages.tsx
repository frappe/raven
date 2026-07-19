import { useState } from "react"
import { Outlet, useMatch, useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Search as SearchIcon, X } from "lucide-react"

import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { ChannelSelect } from "@components/common/ChannelSelect"
import SavedMessagesList from "@components/features/saved-messages/SavedMessagesList"
import { PageHeader } from "@components/layout/PageHeader"
import { NotificationsEmptyState, type SelectedNotification } from "@pages/notifications/NotificationChat"
import { Input } from "@components/ui/input"
import { useIsMobile } from "@hooks/use-mobile"
import { useChannelList } from "@stores/channels/useChannelList"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@db"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

// --- Reminders (not yet backed by the API — see SavedMessage doctype) ---
// Saved messages are currently a binary `_liked_by` bookmark. Status tabs
// (in_progress/archived/completed), `saved_at` and reminders require new
// Raven Message fields + API support. Scaffolding kept commented for later.
// import { ReminderDialog } from "@components/features/saved-messages/ReminderDialog"
// import { Plus } from "lucide-react"
// import { Tabs, TabsList, TabsTrigger } from "@components/ui/tabs"
// import { Button } from "@components/ui/button"
// import { SavedMessage, SavedMessageStatus } from "../../types/SavedMessage"

const SavedMessages = () => {
    const [search, setSearch] = useState('')
    const [channel, setChannel] = useState('*all')
    const { channels, dmChannels } = useChannelList()
    const users = useLiveQuery(() => db.users.toArray(), [])
    const isMobile = useIsMobile()

    // The open message is ROUTE-driven (same as notifications): `/saved-messages/:channelID/:messageID`
    // renders NotificationChatRoute in the right pane's Outlet. Being a history entry means
    // the mobile back chevron / OS back-swipe pop to this list, and refresh restores the chat.
    const navigate = useNavigate()
    const selectedMessageID = useMatch("/saved-messages/:channelID/:messageID")?.params.messageID
    const hasSelection = !!selectedMessageID

    const onSelect = (selection: SelectedNotification) => {
        navigate(
            `/saved-messages/${encodeURIComponent(selection.channelID)}/${encodeURIComponent(selection.messageID)}`,
            {
                // Thread/DM context for the pane — a cold deep-link derives it instead.
                state: {
                    isThread: selection.isThread,
                    isDirectMessage: selection.isDirectMessage,
                    peerID: selection.peer?.name,
                },
                // First open pushes (one back closes the chat); switching between
                // messages replaces, so back never walks through every chat viewed.
                replace: hasSelection,
            },
        )
    }

    // Esc closes the open chat — the static right pane falls back to its empty state.
    useHotkeys('esc', () => {
        if (hasSelection) navigate('/saved-messages')
    }, { enableOnFormTags: true }, [hasSelection])

    const searchInput = (
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4 pointer-events-none" />
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={_('Search saved messages')}
                className="pl-9 pr-9 h-9 md:h-8 text-xl md:text-base"
                autoFocus
            />
            {search && (
                <button
                    type="button"
                    onClick={() => setSearch('')}
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
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left pane: full width on mobile (the open chat covers it as a layer);
                    pinned at 45% on desktop beside the static chat pane — mirrors the
                    threads / notifications split. */}
                <div
                    className="relative flex flex-col min-w-0 w-full md:w-[45%] md:max-w-[50%] md:shrink-0 bg-surface-base md:bg-surface-sidebar"
                    // While covered by the mobile chat layer, keep the list out of
                    // focus / accessibility order.
                    inert={isMobile && hasSelection ? true : undefined}
                >
                    <PageHeader title={_('Saved Messages')} />

                    <div className="shrink-0 p-2 space-y-3">
                        {searchInput}
                        <div className="flex items-center gap-2">
                            {/* --- Reminders: tabs + add-reminder button (commented until backend support) --- */}
                            {/* <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SavedMessageStatus)}>
                                <TabsList variant="subtle" size="sm">
                                    {TABS.map(tab => (
                                        <TabsTrigger key={tab.key} value={tab.key}>{_(tab.label)}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs> */}
                            <ChannelSelect
                                channels={channels}
                                dmChannels={dmChannels}
                                users={users}
                                value={channel}
                                onValueChange={setChannel}
                                placeholder={_('Channel')}
                                allowAll
                                allLabel={_('Any Channel')}
                                searchable
                                size="sm"
                                showLabel={false}
                                dropdownClassName="w-68"
                                className={isMobile ? "w-full min-w-0" : undefined}
                                triggerClassName="w-40"
                            />
                            {/* <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReminderDialogOpen(true)}>
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                {_("Add reminder")}
                            </Button> */}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 px-3 md:px-0 pb-2">
                        <SavedMessagesList
                            searchQuery={search}
                            channel={channel}
                            onSelect={onSelect}
                            selectedID={selectedMessageID}
                        />
                    </div>
                </div>

                {/* Right pane: static on desktop — empty state until a saved message is
                    selected (mirrors threads / notifications). On mobile it's a full-screen
                    layer over list + tab bar (inset-0 of the OUTER column) while one is
                    open, so the list underneath keeps its scroll position. */}
                <div className={cn(
                    "flex flex-col min-w-0 min-h-0 bg-surface-gray-1",
                    "max-md:absolute max-md:inset-0 max-md:z-20 animate-layer-in",
                    !hasSelection && "max-md:hidden",
                    "md:flex-1",
                )}>
                    {hasSelection
                        ? <Outlet />
                        : <NotificationsEmptyState message={_("Select a saved message to view the conversation.")} />}
                </div>
            </div>

            {/* --- Reminder dialog (commented until backend support) --- */}
            {/* <ReminderDialog ... /> */}

            <AppMobileFooter inert={isMobile && hasSelection ? true : undefined} />
        </div>
    )
}

export default SavedMessages
