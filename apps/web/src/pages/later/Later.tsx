import { useState } from "react"
import { Outlet, useMatch, useNavigate, useSearchParams } from "react-router-dom"
import { useEscHotkey } from '@hooks/useEscHotkey'
import { Search as SearchIcon, X } from "lucide-react"

import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { ChannelFilter } from "@components/common/filters/ChannelFilter"
import SavedMessagesList from "@components/features/saved-messages/SavedMessagesList"
import RemindersList from "@components/features/reminders/RemindersList"
import { PageHeader } from "@components/layout/PageHeader"
import { NotificationsEmptyState, type SelectedNotification } from "@pages/notifications/NotificationChat"
import { Input } from "@components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@components/ui/tabs"
import { useIsMobile } from "@hooks/use-mobile"
import { useLayerInAnimation } from "@hooks/useLayerInAnimation"
import { useChannelList } from "@stores/channels/useChannelList"
import { useUsers } from "@hooks/useUsers"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

type LaterTab = 'in-progress' | 'saved' | 'completed'

const TABS: { key: LaterTab; label: string }[] = [
    { key: 'in-progress', label: 'In progress' },
    { key: 'saved', label: 'Saved' },
    { key: 'completed', label: 'Completed' },
]

/** Later (Slack-style). Tabs are view state (threads pattern); push notifications
 *  deep-link to `/later/{channel}/{message}` and land on the default In progress tab. */
const Later = () => {
    const [search, setSearch] = useState('')
    const [channel, setChannel] = useState('*all')
    const [tab, setTab] = useState<LaterTab>('in-progress')
    const { channels, dmChannels } = useChannelList()
    const users = useUsers()
    const isMobile = useIsMobile()

    const navigate = useNavigate()
    const selectedMessageID = useMatch("/later/:channelID/:messageID")?.params.messageID
    const hasSelection = !!selectedMessageID
    // No slide when the chat layer is already open on a BACK arrival — see the hook.
    const layerAnimation = useLayerInAnimation(hasSelection)
    // Which REMINDER card is open (`?r=`): two reminders can point at the same
    // message, so the message id alone would highlight both cards.
    const [searchParams] = useSearchParams()
    const selectedReminderID = searchParams.get('r') ?? undefined

    const onSelect = (selection: SelectedNotification, reminderID?: string) => {
        navigate(
            `/later/${encodeURIComponent(selection.channelID)}/${encodeURIComponent(selection.messageID)}`
            + (reminderID ? `?r=${encodeURIComponent(reminderID)}` : ''),
            {
                state: {
                    isThread: selection.isThread,
                    isDirectMessage: selection.isDirectMessage,
                    peerID: selection.peer?.name,
                },
                // Switching between messages replaces — back never walks every chat viewed.
                replace: hasSelection,
            },
        )
    }

    // Esc closes the open chat — the static right pane falls back to its empty state.
    useEscHotkey(() => {
        if (hasSelection) navigate('/later')
    }, { enableOnFormTags: true }, [hasSelection])

    // Shared across tabs — a per-tab search bar made the tabs row jump on switch.
    const searchInput = (
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4 pointer-events-none" />
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'saved'
                    ? _('Search saved messages')
                    : tab === 'completed'
                        ? _('Search completed reminders')
                        : _('Search reminders')}
                className="pl-9 pr-9 h-9 md:h-8 text-xl md:text-base"
                autoFocus={!isMobile}
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
        // The mobile chat layer (inset-0 below) covers list + footer; the footer
        // stays mounted and inerted while covered (see AppMobileFooter).
        <div className="relative flex flex-col h-dvh overflow-hidden">
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* 45% list pane on desktop — mirrors the threads / notifications split. */}
                <div
                    className="relative flex flex-col min-w-0 w-full md:w-[45%] md:max-w-[50%] md:shrink-0 bg-surface-base md:bg-surface-sidebar"
                    inert={isMobile && hasSelection ? true : undefined}
                >
                    <PageHeader title={_('Later')} />

                    <div className="shrink-0 p-2 space-y-3">
                        {searchInput}
                        <div className="flex flex-row items-center gap-1 md:justify-between">
                            {/* Switching tabs also closes any open chat. */}
                            <Tabs
                                value={tab}
                                onValueChange={(v) => {
                                    setTab(v as LaterTab)
                                    if (hasSelection) navigate('/later')
                                }}
                                className="min-w-0 shrink-0"
                            >
                                <TabsList variant="subtle" size="md">
                                    {TABS.map(t => (
                                        <TabsTrigger key={t.key} value={t.key}>
                                            {_(t.label)}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                            <div className="flex items-center gap-1 min-w-0 flex-1 md:flex-none">
                                <ChannelFilter
                                    channels={channels}
                                    dmChannels={dmChannels}
                                    users={users}
                                    value={channel}
                                    onValueChange={setChannel}
                                    className="w-full min-w-0"
                                    triggerClassName="w-full max-w-50 md:w-50"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 px-3 md:px-0 pb-2">
                        {tab === 'saved' ? (
                            <SavedMessagesList
                                searchQuery={search}
                                channel={channel}
                                onSelect={onSelect}
                                selectedID={selectedMessageID}
                            />
                        ) : (
                            <RemindersList
                                searchQuery={search}
                                channel={channel}
                                mode={tab}
                                onSelect={onSelect}
                                selectedID={selectedMessageID}
                                selectedReminderID={selectedReminderID}
                            />
                        )}
                    </div>
                </div>

                {/* Right pane: desktop split view; mobile full-screen layer. */}
                <div className={cn(
                    "flex flex-col min-w-0 min-h-0 bg-surface-gray-1",
                    "max-md:absolute max-md:inset-0 max-md:z-20",
                    layerAnimation,
                    !hasSelection && "max-md:hidden",
                    "md:flex-1",
                )}>
                    {hasSelection
                        ? <Outlet />
                        : <NotificationsEmptyState message={tab === 'saved'
                            ? _("Select a saved message to view the conversation.")
                            : _("Select a reminder to view the conversation.")} />}
                </div>
            </div>

            <AppMobileFooter inert={isMobile && hasSelection ? true : undefined} />
        </div>
    )
}

export default Later
