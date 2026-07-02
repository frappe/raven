import { useState, useCallback } from "react"
import { Check } from "lucide-react"
import { Virtuoso } from "react-virtuoso"
import { useNotificationList } from "@stores/notifications/useNotificationList"
import { useUnreadNotificationsCount } from "@hooks/useNotifications"
import { useUsersById } from "@hooks/useMessageRowLookups"
import _ from "@lib/translate"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@components/ui/tabs"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@components/ui/empty"
import { useIsMobile } from "@hooks/use-mobile"
import { PageHeader } from "@components/layout/PageHeader"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import NotificationChat, { type SelectedNotification } from "./NotificationChat"
import { MentionItem, ReactionItem } from "./NotificationItem"

type NotificationTab = "all" | "mentions" | "reactions"

const TABS: { key: NotificationTab; label: string; type: "mention" | "reaction" | null }[] = [
    { key: "all", label: "All", type: null },
    { key: "mentions", label: "Mentions", type: "mention" },
    { key: "reactions", label: "Reactions", type: "reaction" },
]

export default function Notifications() {
    const [activeTab, setActiveTab] = useState<NotificationTab>("all")
    const [showUnread, setShowUnread] = useState(true)
    const [selected, setSelected] = useState<SelectedNotification | null>(null)
    const hasSelection = !!selected
    const isMobile = useIsMobile()

    const tab: "all" | "mention" | "reaction" =
        activeTab === "mentions" ? "mention" : activeTab === "reactions" ? "reaction" : "all"

    const {
        rows: currentData,
        isLoading,
        hasMore,
        loadMore: loadMoreRows,
        markMessageRead,
        markAllRead,
    } = useNotificationList(tab, { unreadOnly: showUnread })

    const { data: unreadCountData } = useUnreadNotificationsCount()
    const unreadCount = unreadCountData?.message ?? 0

    const usersById = useUsersById()

    const loadMore = useCallback(() => {
        if (hasMore) loadMoreRows()
    }, [hasMore, loadMoreRows])

    const onSelect = useCallback((selection: SelectedNotification) => {
        setSelected(selection)
        markMessageRead(selection.messageID)
    }, [setSelected, markMessageRead])

    const onShowUnreadChange = useCallback((checked: boolean) => {
        setShowUnread(checked)
        setSelected(null)
    }, [setSelected])

    const onTabChange = useCallback((tab: NotificationTab) => {
        setActiveTab(tab)
        setSelected(null)
    }, [setSelected])

    const shouldShowSidebar = !isMobile || !hasSelection

    return (
        <div className="flex flex-col h-full min-h-0 w-full">
            <div className="flex min-h-0 flex-1">
                {shouldShowSidebar && (
                    <div className="md:w-(--notifications-sidebar-width) w-full shrink-0 min-h-0">
                        <nav className="flex h-full w-full flex-col bg-surface-base md:bg-surface-sidebar">
                            <PageHeader title={_("Notifications")}>
                                {unreadCount > 0 && (
                                    <Badge variant="subtle" size="sm" theme="gray">
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </Badge>
                                )}
                            </PageHeader>

                            <div className="shrink-0 px-2 pb-2">
                                <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as NotificationTab)}>
                                    <TabsList variant="subtle" className="w-full">
                                        {TABS.map((t) => (
                                            <TabsTrigger key={t.key} value={t.key} className="flex-1">
                                                {_(t.label)}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2">
                                <div className="flex items-center gap-2">
                                    <Label
                                        htmlFor="unread-toggle"
                                        className="cursor-pointer text-xs font-medium text-ink-gray-4"
                                    >
                                        {_("Unread only")}
                                    </Label>
                                    <Switch
                                        id="unread-toggle"
                                        checked={showUnread}
                                        onCheckedChange={onShowUnreadChange}
                                    />
                                </div>
                                {unreadCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={markAllRead}>
                                        <Check />
                                        {_("Mark all as read")}
                                    </Button>
                                )}
                            </div>

                            <div className="flex min-h-0 flex-1">
                                {currentData.length === 0 && !isLoading ? (
                                    <EmptyState showUnread={showUnread} />
                                ) : (
                                    <Virtuoso
                                        className="flex-1 min-h-0"
                                        style={{ height: "100%" }}
                                        data={currentData}
                                        endReached={loadMore}
                                        overscan={200}
                                        defaultItemHeight={80}
                                        computeItemKey={(_index, item) => item.name}
                                        itemContent={(_index, item) =>
                                            item.notification_type === "mention" ? (
                                                <MentionItem
                                                    notification={item}
                                                    sender={usersById.get(item.owner)}
                                                    isActive={selected?.messageID === item.message_id}
                                                    onSelect={onSelect}
                                                />
                                            ) : (
                                                <ReactionItem
                                                    notification={item}
                                                    usersById={usersById}
                                                    isActive={selected?.messageID === item.message_id}
                                                    onSelect={onSelect}
                                                />
                                            )
                                        }
                                    />
                                )}
                            </div>
                        </nav>
                    </div>
                )}
                <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-surface-gray-1">
                    <NotificationChat selected={selected} />
                </div>
            </div>
            {!hasSelection && <AppMobileFooter />}
        </div>
    )
}

const EmptyState = ({ showUnread }: { showUnread: boolean }) => (
    <Empty>
        <EmptyHeader>
            <EmptyTitle>{showUnread ? _("You're all caught up") : _("No notifications yet")}</EmptyTitle>
            <EmptyDescription>
                {showUnread
                    ? _("No unread notifications at the moment.")
                    : _("Mentions and reactions to your messages will appear here.")
                }
            </EmptyDescription>
        </EmptyHeader>
    </Empty>
)
