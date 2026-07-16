import { useCallback, useState } from "react"
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

    // Clicking the open row again collapses the pane back to a full-width list.
    const onSelect = useCallback((selection: SelectedNotification) => {
        setSelected(prev => prev?.messageID === selection.messageID ? null : selection)
    }, [])

    // Esc closes the pane (no visible close button — toggle the row or hit Esc).
    useHotkeys('esc', () => setSelected(null), { enableOnFormTags: true }, [])

    const searchInput = (
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4 pointer-events-none" />
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={_('Search saved messages')}
                className={cn("pl-9 pr-9 h-9 md:h-8 text-xl md:text-base",
                    hasSelection && "bg-surface-gray-3 hover:bg-surface-gray-4"
                )}
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
        <div className={cn(
            "flex flex-col h-screen overflow-hidden",
            hasSelection && "bg-surface-gray-1"
        )}>
            <div className="flex flex-1 overflow-hidden">
                {/* Left pane: full width by default; exact half once a row is selected (no divider — the
                    right pane's gray canvas separates them). On mobile a selection takes over the whole
                    screen, so the list pane is hidden (mirrors notifications / search). */}
                <div className={cn(
                    "relative flex flex-col min-w-0",
                    hasSelection ? "w-1/2 shrink-0" : "flex-1",
                    isMobile && hasSelection && "hidden"
                )}>
                    <PageHeader title={_('Saved Messages')} />

                    <div className="shrink-0 px-2 pt-2 pb-2 space-y-2">
                        {searchInput}
                        <div className="mt-3 flex items-center gap-2">
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
                                triggerClassName={"w-40"}
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
                            selectedID={selected?.messageID}
                        />
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

            {/* --- Reminder dialog (commented until backend support) --- */}
            {/* <ReminderDialog ... /> */}

            <AppMobileFooter />
        </div>
    )
}

export default SavedMessages
