import { useCallback, useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import { Search, X } from "lucide-react"
import { Switch } from "@components/ui/switch"
import { Label } from "@components/ui/label"
import { Input } from "@components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@components/ui/tabs"
import { Empty, EmptyHeader, EmptyDescription } from "@components/ui/empty"
import { ChannelSelect } from "@components/common/ChannelSelect/ChannelSelect"
import ThreadsList from "@components/features/threads/ThreadsList"
import { ThreadMessage } from "../../types/ThreadMessage"
import { useChannelList } from "@stores/channels/useChannelList"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { PageHeader } from "@components/layout/PageHeader"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { Island } from "@components/layout/Island"

type ThreadTab = 'participating' | 'ai' | 'other'

const TABS: { key: ThreadTab; label: string }[] = [
    { key: 'participating', label: 'Participating' },
    { key: 'other', label: 'Other' },
    { key: 'ai', label: 'AI Agents' },
]

/** The thread pane (Outlet) reads this off the location state — the parent channel of the
 *  clicked thread, used by ThreadDrawer for the composer's mention banner + root-message
 *  lookup. Absent on a cold deep-link, where ThreadDrawer degrades gracefully. */
type ThreadNavState = { parentChannelID?: string } | null

export default function Threads() {
    const [activeTab, setActiveTab] = useState<ThreadTab>('participating')
    const [onlyShowUnread, setOnlyShowUnread] = useState(false)
    const [search, setSearch] = useState('')
    const [channel, setChannel] = useState('*all')
    const usersById = useUsersById()
    const users = useMemo(() => [...usersById.values()], [usersById])
    const { channels, dmChannels } = useChannelList()
    const isMobile = useIsMobile()

    // The opened thread is URL-driven: `/threads/:threadID` renders ThreadDrawer in the
    // Outlet beside the list (a thread IS a channel, id = thread.name).
    const navigate = useNavigate()
    const { threadID } = useParams<{ threadID: string }>()
    const { state } = useLocation()
    // The click carries the parent channel via nav state; on a cold refresh it's absent and
    // ThreadDrawerRoute resolves it from the thread's (already-fetched) root message instead.
    const parentChannelID = (state as ThreadNavState)?.parentChannelID
    const hasThread = !!threadID

    const onThreadClick = useCallback((thread: ThreadMessage) => {
        // Engaging with a thread = reading it: clear its unread dot immediately (optimistic;
        // the pane's read tracker flushes the watermark to the server). Pass the parent channel
        // via nav state so ThreadDrawer's mention banner + root-message lookup are accurate.
        unreadThreadsStore.remove(thread.name)
        navigate(thread.name, { state: { parentChannelID: thread.channel_id } })
    }, [navigate])

    const list = (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <PageHeader title={_("Threads")} />
            <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-2 pt-2 pb-3 shrink-0 space-y-4 z-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4 pointer-events-none" />
                        <Input
                            placeholder={_("Search threads...")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-9 h-8 text-base"
                            autoFocus
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                aria-label={_("Clear search")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-gray-4 hover:text-ink-gray-8"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ThreadTab)}>
                            <TabsList variant="subtle" size="sm">
                                {TABS.map(tab => (
                                    <TabsTrigger key={tab.key} value={tab.key}>
                                        {_(tab.label)}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="unread-toggle" className="text-xs font-medium text-ink-gray-4 cursor-pointer">
                                    {_("Unread only")}
                                </Label>
                                <Switch
                                    id="unread-toggle"
                                    checked={onlyShowUnread}
                                    onCheckedChange={setOnlyShowUnread}
                                />
                            </div>
                            <ChannelSelect
                                channels={channels}
                                dmChannels={dmChannels}
                                users={users}
                                value={channel}
                                onValueChange={setChannel}
                                placeholder={_("Channel")}
                                allowAll
                                allLabel={_("Any Channel")}
                                searchable
                                size="sm"
                                showLabel={false}
                                dropdownClassName="w-68"
                                triggerClassName="w-40"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <ThreadsList
                        threadType={activeTab}
                        searchQuery={search}
                        channelFilter={channel}
                        onlyShowUnread={onlyShowUnread}
                        onThreadClick={onThreadClick}
                        activeThreadID={threadID}
                    />
                </div>
            </div>
        </div>
    )

    // Mobile: a single full-bleed pane — the open thread takes over, else the list.
    if (isMobile) {
        return (
            <div className="flex flex-col h-screen overflow-hidden">
                <div className="flex flex-1 overflow-hidden">
                    {hasThread ? <Outlet context={{ parentChannelID }} /> : list}
                </div>
                {hasThread ? null : <AppMobileFooter />}
            </div>
        )
    }

    // Desktop: list pinned at ~45%, the thread pane fills the rest (empty state until one opens).
    return (
        <div className="flex flex-col h-screen overflow-hidden bg-surface-gray-1">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex w-[45%] max-w-[50%] min-w-0 shrink-0 flex-col">
                    {list}
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-1 p-0 md:p-1">
                    <Island className="w-full h-full shrink-0">
                        <div className="flex flex-col flex-1 min-h-0">
                            {hasThread ? (
                                <Outlet context={{ parentChannelID }} />
                            ) : (
                                <Empty className="h-full">
                                    <EmptyHeader>
                                        <EmptyDescription>{_("Select a thread to view the conversation.")}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </div>
                    </Island>
                </div>
            </div>
        </div>
    )
}
