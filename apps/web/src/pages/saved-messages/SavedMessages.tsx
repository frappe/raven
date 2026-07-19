import { useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Search as SearchIcon, X } from "lucide-react"

import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { ChannelSelect } from "@components/common/ChannelSelect"
import SavedMessagesList from "@components/features/saved-messages/SavedMessagesList"
import { PageHeader } from "@components/layout/PageHeader"
import NotificationChat, { type SelectedNotification } from "@pages/notifications/NotificationChat"
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
    const [selected, setSelected] = useState<SelectedNotification | null>(null)
    const { channels, dmChannels } = useChannelList()
    const users = useLiveQuery(() => db.users.toArray(), [])
    const hasSelection = !!selected
    const isMobile = useIsMobile()

    // Esc clears the selection — the static right pane falls back to its empty state.
    useHotkeys('esc', () => setSelected(null), { enableOnFormTags: true }, [])

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
        <div className="flex flex-col h-dvh overflow-hidden">
            {/* relative for the mobile chat layer (absolute inset-0 below). */}
            <div className="relative flex flex-1 overflow-hidden">
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
                            onSelect={setSelected}
                            selectedID={selected?.messageID}
                        />
                    </div>
                </div>

                {/* Right pane: static on desktop — empty state until a saved message is
                    selected (mirrors threads / notifications). On mobile it's a full-screen
                    layer over the list while one is open, so the list underneath keeps its
                    scroll position. */}
                <div className={cn(
                    "flex flex-col min-w-0 min-h-0 bg-surface-gray-1",
                    "max-md:absolute max-md:inset-0 max-md:z-20 animate-layer-in",
                    !hasSelection && "max-md:hidden",
                    "md:flex-1",
                )}>
                    <NotificationChat
                        selected={selected}
                        onClose={() => setSelected(null)}
                        emptyMessage={_("Select a saved message to view the conversation.")}
                    />
                </div>
            </div>

            {/* --- Reminder dialog (commented until backend support) --- */}
            {/* <ReminderDialog ... /> */}

            <AppMobileFooter />
        </div>
    )
}

export default SavedMessages
