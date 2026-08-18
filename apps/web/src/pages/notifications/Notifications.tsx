import { useState, useCallback } from "react"
import { Outlet, useMatch, useNavigate } from "react-router-dom"
import { BellCheckIcon, Check, CheckCheckIcon, Inbox, MoreVertical } from "lucide-react"
import { Virtuoso } from "react-virtuoso"
import { useNotificationList } from "@stores/notifications/useNotificationList"
import { useUnreadNotificationsCount } from "@hooks/useNotifications"
import { useUsersById } from "@hooks/useMessageRowLookups"
import _ from "@lib/translate"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@components/ui/tabs"
import { UnreadFilterPill } from "@components/common/UnreadFilterPill"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@components/ui/empty"
import { Skeleton } from "@components/ui/skeleton"
import { useIsMobile } from "@hooks/use-mobile"
import { useLayerInAnimation } from "@hooks/useLayerInAnimation"
import { PageHeader } from "@components/layout/PageHeader"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { NotificationsEmptyState, type SelectedNotification } from "./NotificationChat"
import { MentionItem, ReactionItem } from "./NotificationItem"
import { PullToRefresh } from "@components/ui/pull-to-refresh"
import ErrorBanner from "@components/ui/error-banner"
import { cn } from "@lib/utils"

type NotificationTab = "all" | "mentions" | "reactions"

const TABS: { key: NotificationTab; label: string; type: "mention" | "reaction" | null }[] = [
    { key: "all", label: "All", type: null },
    { key: "mentions", label: "Mentions", type: "mention" },
    { key: "reactions", label: "Reactions", type: "reaction" },
]

/** Module-level Footer so Virtuoso's component type stays stable across renders.
 *  Mobile: small breathing pad above the tab bar. */
const NotificationsListFooter = () => <div className="h-2 md:h-0" aria-hidden="true" />
const notificationsListComponents = { Footer: NotificationsListFooter }

export default function Notifications() {
    const [activeTab, setActiveTab] = useState<NotificationTab>("all")
    const [showUnread, setShowUnread] = useState(true)
    const isMobile = useIsMobile()

    // The open notification is route-driven: `/notifications/:channelID/:messageID`
    // renders NotificationChatRoute in the Outlet. Being in history means the mobile
    // back-swipe closes the chat (instead of leaving the page) and refresh restores it.
    // This layout mounts above the child route, so useParams can't see its params —
    // match the path instead.
    const navigate = useNavigate()
    const selectedMessageID = useMatch("/notifications/:channelID/:messageID")?.params.messageID
    const hasSelection = !!selectedMessageID
    // No slide when the chat layer is already open on a BACK arrival — see the hook.
    const layerAnimation = useLayerInAnimation(hasSelection)

    const tab: "all" | "mention" | "reaction" =
        activeTab === "mentions" ? "mention" : activeTab === "reactions" ? "reaction" : "all"

    const {
        rows: currentData,
        leavingIds,
        isLoading,
        error,
        hasMore,
        loadMore: loadMoreRows,
        refresh,
        markMessageRead,
        markAllRead,
        // activeMessageID exempts the OPEN notification from the unread view's
        // leave pipeline — a read row only slides out once the user moves on.
    } = useNotificationList(tab, { unreadOnly: showUnread, activeMessageID: selectedMessageID })

    const unreadCount = useUnreadNotificationsCount()

    const usersById = useUsersById()

    // Pull-to-refresh needs the real scrolling element (Virtuoso's scroller).
    const [listScroller, setListScroller] = useState<HTMLElement | null>(null)

    const loadMore = useCallback(() => {
        if (hasMore) loadMoreRows()
    }, [hasMore, loadMoreRows])

    const onSelect = useCallback((selection: SelectedNotification) => {
        markMessageRead(selection.messageID)
        navigate(
            `/notifications/${encodeURIComponent(selection.channelID)}/${encodeURIComponent(selection.messageID)}`,
            {
                // Thread/DM context for the pane — a cold deep-link derives it instead.
                state: {
                    isThread: selection.isThread,
                    isDirectMessage: selection.isDirectMessage,
                    peerID: selection.peer?.name,
                },
                // First open pushes (one back closes the chat); switching between
                // notifications replaces, so back never walks through every chat viewed.
                replace: hasSelection,
            },
        )
    }, [markMessageRead, navigate, hasSelection])

    // Swipe-to-read expedites the leave: the gesture already carried the row
    // off-screen, so the pipeline skips its linger and closes the gap now.
    const onSwipeRead = useCallback((messageID: string) => {
        markMessageRead(messageID, { expedite: true })
    }, [markMessageRead])

    const onShowUnreadChange = useCallback((checked: boolean) => {
        setShowUnread(checked)
        if (hasSelection) navigate("/notifications", { replace: true })
    }, [hasSelection, navigate])

    const onTabChange = useCallback((tab: NotificationTab) => {
        setActiveTab(tab)
        if (hasSelection) navigate("/notifications", { replace: true })
    }, [hasSelection, navigate])

    return (
        // relative on the OUTER column: the mobile chat layer covers list + footer,
        // sliding over the tab bar like a native detail page. The footer stays MOUNTED —
        // unmounting it resized the list row, which clamped the list's scroll position
        // at the bottom.
        <div className="relative flex flex-col h-full min-h-0 w-full">
            {/* Mobile is STACKED navigation (same as WorkspaceLayout): the list is the page
                and the open notification's chat is a full-screen layer on top of it. The
                list stays mounted underneath, so going back — chevron or iOS back-swipe —
                reveals it instantly at the same scroll position. */}
            <div className="flex min-h-0 flex-1">
                <div
                    className="md:w-(--notifications-sidebar-width) w-full shrink-0 min-h-0"
                    // While covered by the chat layer on mobile, keep the list out of
                    // focus / accessibility order.
                    inert={isMobile && hasSelection ? true : undefined}
                >
                    <nav className="relative flex h-full w-full flex-col bg-surface-base md:bg-surface-sidebar">
                        <PageHeader title={_("Notifications")}>
                            {unreadCount > 0 && (
                                <Badge variant="subtle" size="sm" theme="gray">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </Badge>
                            )}
                            <div className="ml-auto flex items-center gap-2">
                                <div className="hidden md:flex items-center gap-2 px-1">
                                    <Label htmlFor="unread-toggle" className="text-xs-medium text-ink-gray-6 cursor-pointer">
                                        {_("Unread only")}
                                    </Label>
                                    <Switch
                                        id="unread-toggle"
                                        checked={showUnread}
                                        onCheckedChange={onShowUnreadChange}
                                    />
                                </div>
                                {unreadCount > 0 && (
                                    <Button variant={isMobile ? "ghost" : "subtle"} size={isMobile ? "md" : "sm"} onClick={markAllRead} aria-label={_("Mark all as read")}>
                                        <CheckCheckIcon />
                                        {_("Mark all as read")}
                                    </Button>
                                )}
                            </div>
                        </PageHeader>

                        <div className="shrink-0 px-2 p-2">
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

                        {/* Empty state centers over the whole nav (absolute) so it lands at the
                                same height as the right pane's empty state, not offset below the
                                header + tabs. pointer-events-none keeps those clickable. Error
                                state takes precedence over "caught up" — a failed load must not
                                masquerade as an empty inbox (the badge may still show unreads). */}
                        {/* z-10: the PullToRefresh list wrapper below is position:relative
                                (for its floating spinner) and later in source order, so it
                                paints ABOVE this overlay and would swallow the error card's
                                clicks — transparent elements still hit-test. */}
                        {currentData.length === 0 && !isLoading && (
                            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                                {error ? (
                                    <ErrorBanner
                                        error={error}
                                        layout="centered"
                                        overrideHeading={_("Couldn't load notifications")}
                                        className="pointer-events-auto"
                                    >
                                        <Button variant="outline" size="sm" onClick={() => refresh()}>
                                            {_("Retry")}
                                        </Button>
                                    </ErrorBanner>
                                ) : (
                                    <EmptyState showUnread={showUnread} />
                                )}
                            </div>
                        )}
                        <PullToRefresh scroller={listScroller} onRefresh={refresh}>
                            {currentData.length === 0 && isLoading && <NotificationListSkeleton />}
                            {currentData.length > 0 && (
                                <Virtuoso
                                    className="flex-1 min-h-0"
                                    style={{ height: "100%" }}
                                    data={currentData}
                                    endReached={loadMore}
                                    overscan={200}
                                    components={notificationsListComponents}
                                    defaultItemHeight={80}
                                    computeItemKey={(_index, item) => item.name}
                                    scrollerRef={(el) => setListScroller(el instanceof HTMLElement ? el : null)}
                                    itemContent={(_index, item) =>
                                        item.notification_type === "mention" ? (
                                            <MentionItem
                                                notification={item}
                                                sender={usersById.get(item.owner)}
                                                isActive={selectedMessageID === item.message_id}
                                                leaving={leavingIds.has(item.name)}
                                                swipeDismisses={showUnread}
                                                onSelect={onSelect}
                                                onMarkRead={onSwipeRead}
                                            />
                                        ) : (
                                            <ReactionItem
                                                notification={item}
                                                usersById={usersById}
                                                isActive={selectedMessageID === item.message_id}
                                                leaving={leavingIds.has(item.name)}
                                                swipeDismisses={showUnread}
                                                onSelect={onSelect}
                                                onMarkRead={onSwipeRead}
                                            />
                                        )
                                    }
                                />
                            )}
                        </PullToRefresh>
                        <UnreadFilterPill active={showUnread} onToggle={onShowUnreadChange} />
                    </nav>
                </div>
                {/* Mobile: full-screen chat layer above the list while a notification is
                    open, hidden when none is. Covers the footer too (inset-0 of the
                    outer column). Desktop: a normal column beside the list. */}
                <div className={cn(
                    "flex min-w-0 min-h-0 flex-col bg-surface-gray-1",
                    "max-md:absolute max-md:inset-0 max-md:z-20",
                    layerAnimation,
                    !hasSelection && "max-md:hidden",
                    "md:flex-1",
                )}>
                    {hasSelection ? <Outlet /> : <NotificationsEmptyState />}
                </div>
            </div>
            <AppMobileFooter inert={isMobile && hasSelection ? true : undefined} />
        </div>
    )
}

/** Loading placeholder for the notifications list — mirrors the row anatomy
 * (avatar · name + relative date · channel context · two body lines) so the
 * real rows land without a layout jump. Width variance keeps it organic. */
const NotificationListSkeleton = () => (
    <div className="flex-1 overflow-hidden px-2 py-0.5" aria-hidden="true">
        {[56, 40, 64, 48, 72, 44, 60, 52].map((nameWidth, i) => (
            <div key={i} className="flex w-full items-start gap-3 px-2 py-3 md:py-2">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                        <Skeleton className="h-2.5" style={{ width: nameWidth * 2 }} />
                        <Skeleton className="h-2 w-10" />
                    </div>
                    <div className="pt-1.5 space-y-1.5">
                        <Skeleton className="h-2.5" style={{ width: `${nameWidth + 20}%` }} />
                        <Skeleton className="h-4" style={{ width: `${nameWidth}%` }} />
                    </div>
                </div>
            </div>
        ))}
    </div>
)

const EmptyState = ({ showUnread }: { showUnread: boolean }) => (
    <Empty>
        <EmptyMedia>{showUnread ? <BellCheckIcon /> : <Inbox />}</EmptyMedia>
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
