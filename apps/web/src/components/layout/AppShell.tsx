import { lazy, Suspense, useEffect } from "react"
import { MainPageSkeleton } from "@components/features/main-page/MainPageSkeleton"
import { isLoggedIn } from "@lib/sessionUser"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import { useIsMobile } from "@hooks/use-mobile"
import { useLoadUsers } from "@hooks/useLoadUsers"
import _ from "@lib/translate"
import { AlertCircle, WifiOffIcon } from "lucide-react"
import { Outlet } from "react-router"
import PrimarySidebar from "./PrimarySidebar/PrimarySidebar"
import CommandMenu from "@components/features/cmdk/CommandMenu"
import { AttachmentPreviewModal } from "@components/features/message/renderers/AttachmentPreviewModal"
import { useUnreadSync } from "@stores/unread/useUnreadSync"
import { useUnreadRealtime } from "@stores/unread/useUnreadRealtime"
import { useMessageRoomSubscriptions } from "@stores/messages/useMessageRoomSubscriptions"
import { useMessagesRealtime } from "@stores/messages/useMessagesRealtime"
import { useLinkPreviewsRealtime } from "@stores/linkPreviews/useLinkPreview"
import { useConnectionFreshness } from "@hooks/useConnectionFreshness"
import { useOnlineStatus } from "@stores/connectionState"
import { cn } from "@lib/utils"
import { useActiveSocketConnection } from "@hooks/useActiveSocketConnection"
import { useOutboxAutoRetry } from "@stores/messages/useOutboxAutoRetry"
import { useChannelListRealtime } from "@hooks/useChannelListRealtime"
import { useChannelListSync } from "@stores/channels/useChannelListSync"
import { useRegisterCustomEmojis } from "@hooks/useRegisterCustomEmojis"
import { usePresenceSync } from "@stores/presence/usePresenceSync"
import { useLeaveSync } from "@stores/leave/useLeaveSync"
import { useThreadsRealtime } from "@stores/threads/useThreadsRealtime"
import { useUnreadThreadsSync } from "@stores/threads/useUnreadThreads"
import { useNotificationsRealtime } from "@stores/notifications/useNotificationsRealtime"
import { useUnreadNotificationsSync } from "@hooks/useNotifications"
import { useRemindersRealtime } from "@components/features/reminders/useReminders"
import { useScheduledMessagesRealtime } from "@components/features/schedule-send/useScheduledMessages"
import { useReportActiveState } from "@stores/presence/useReportActiveState"
import { usePushNotificationNavigation } from "@hooks/usePushNotificationNavigation"
import { useAppBadge } from "@hooks/useAppBadge"
import { useClearReadNotifications } from "@hooks/useClearReadNotifications"
import { useRemovedChannelCleanup } from "@hooks/useRemovedChannelCleanup"
import DocumentTitle from "./DocumentTitle"
import { AppUpdateAlert } from "./AppUpdateAlert"
import { SessionBroadcast } from "./SessionBroadcast"
import RavenSettingsDialog from "@components/features/settings/SettingsDialog"
import { MessageActionDialogs } from "@components/features/message/actions/MessageActionDialogs"

/**
 * The AppShell is used to wrap the entire application and provide all the utilities
 * 
 * It includes:
 * 1. Protected Route - if the user is not logged in, redirect to Frappe's login page with the correct route redirect
 * 2. User list fetching
 * 3. Realtime event listeners for the following:
 *  - user list
 *  - workspace list
 *  - channel membership update
 *  - unread message counts (threads, channels, DMs)
 * 4. Initialize push notifications
 * 5. BroadcastChannel listener for user session state updates from Frappe
 * 6. App Update listener to track app updates and show a notification to the user
 * 7. Realtime connection listeners to check if the websocket connection is working + retry mechanism to reconnect to channels once restored
 * 
 */
const AppShell = () => {
    return (
        <ProtectedRoute>
            <AppListeners>
                <AppShellLayout>
                    <Outlet />
                </AppShellLayout>
                {/* SINGLE host for the message dialogs (delete/reactions/forward).
                    They're driven by the global messageDialogAtom and fully derive
                    from dialog.message — hosting them per ChatStream double-rendered
                    every dialog when two streams were mounted (channel + thread). */}
                <MessageActionDialogs />
            </AppListeners>
        </ProtectedRoute>
    )
}

/** Check if the user has the Raven User role */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {

    // A GUEST lacking the role isn't a permissions problem — they're just not
    // logged in, and App.tsx is redirecting them to login. Render nothing so
    // the "no access" alert can't flash at them on the way out (it's meant for
    // LOGGED-IN users who genuinely lack the Raven User role).
    if (!isLoggedIn()) {
        return null
    }

    // Roles can be UNKNOWN, not just missing: an offline launch without a
    // cached boot (browser tabs never cache boot; a first offline launch has
    // no cache yet) leaves window.frappe.boot empty. That is a connectivity
    // problem, not a permissions one — this used to fall into the "no role"
    // alert below and told offline users to contact their administrator.
    // Only a PRESENT roles list can prove the role is actually absent.
    const roles = window.frappe?.boot?.user?.roles
    if (!roles) {
        return <BootUnavailableScreen />
    }

    if (!roles.includes('Raven User')) {
        return <div className="h-screen w-screen flex justify-center items-center">
            <div>
                <Alert
                    theme="red"
                >
                    <AlertCircle />
                    <AlertTitle>{_('You cannot access Raven.')}</AlertTitle>
                    <AlertDescription>{_('You do not have the "Raven User" role. Please contact your system administrator.')}</AlertDescription>
                </Alert>
            </div >

        </div >
    }

    return children

}

/**
 * The app shell loaded but boot never arrived — an offline launch with no
 * cached boot, or the boot request failed. Say that, instead of guessing at
 * permissions. Reloads by itself the moment the connection comes back.
 */
const BootUnavailableScreen = () => {
    useEffect(() => {
        const reload = () => window.location.reload()
        window.addEventListener('online', reload)
        return () => window.removeEventListener('online', reload)
    }, [])

    return (
        <div className="h-screen w-screen flex justify-center items-center">
            <div className="flex max-w-md flex-col gap-3 px-4">
                <Alert>
                    <WifiOffIcon />
                    <AlertTitle>{_("Couldn't load Raven")}</AlertTitle>
                    <AlertDescription>
                        {navigator.onLine
                            ? _("Your account details couldn't be loaded. Please try again in a moment.")
                            : _("You appear to be offline. Raven will load as soon as you're back online.")}
                    </AlertDescription>
                </Alert>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    {_("Retry")}
                </Button>
            </div>
        </div>
    )
}

// Native only: the ternary keeps the chunk out of browser builds entirely.
const NativeBridge = import.meta.env.VITE_NATIVE ? lazy(() => import("../../native/NativeBridge")) : () => null

const AppListeners = ({ children }: { children: React.ReactNode }) => {

    const isReady = useLoadUsers()

    // Seeds + reconciles channel unread counts; the realtime listener keeps them
    // live between reconciles (and updates the DM list's last-message preview)
    useUnreadSync()
    useUnreadRealtime()
    // Joins the socket rooms of all warm channels so they get live message events
    useMessageRoomSubscriptions()
    // Dispatches those live message events into the message store
    useMessagesRealtime()
    // Patches freshly fetched link previews into the link preview store
    useLinkPreviewsRealtime()
    // Health-checks the socket on focus and force-reconnects a dead one (e.g. after a
    // backgrounded tab suspended it) — the reconnect then bumps the connection epoch
    useActiveSocketConnection()
    // Notes a "break" whenever the realtime connection drops (reconnect / offline /
    // the phone froze the app). Channels in memory then refetch on their next open —
    // and the one currently on screen refetches immediately (useChannelMessages)
    useConnectionFreshness()
    // Delivers persisted (pending/failed) sends from the outbox on load + reconnect/online
    useOutboxAutoRetry()
    // Keeps the sidebar channel list + member lists fresh on create/archive/join/leave
    useChannelListRealtime()
    // Seeds the channel store (mirrors the channel_list fetch for now); store will
    // own the fetch + realtime writes once consumers migrate off SWR
    useChannelListSync()
    // Registers Raven's custom emojis with emoji-mart (composer search + pickers)
    useRegisterCustomEmojis()
    // Seeds + live-updates which users are online (read via useIsUserOnline)
    usePresenceSync()
    // Reports OUR own online state (app open / focus / 10-min idle) to the server
    useReportActiveState()
    // Seeds the set of users on leave today (read via useIsUserOnLeave)
    useLeaveSync()
    // Patches thread reply counts (thread_reply) + the unread-threads set (participant-scoped
    // raven:unread_thread_count_updated) live
    useThreadsRealtime()
    // Seeds + reconciles the unread-threads set (read via useUnreadThreadsCount)
    useUnreadThreadsSync()
    // Notifications: reconcile the warm tab windows on new mention/reaction + keep the
    // unread-id set live (page + sidebar badge), even when the Notifications page is closed.
    useNotificationsRealtime()
    // Seeds + reconciles the unread-notification id set (badge = set size; ids are marked
    // read as their messages scroll into view — markNotificationsReadOnView)
    useUnreadNotificationsSync()
    // Reminders: the single subscriber for raven_reminders_updated. Revalidates the
    // Later badge and list by SWR key, so no page-level hook needs its own socket listener.
    useRemindersRealtime()
    // Scheduled messages: the single subscriber for raven_scheduled_message_updated.
    // Refreshes the badge count and rebroadcasts through the bus for the list.
    useScheduledMessagesRealtime()
    // Focus-and-route when a push notification is clicked while a window exists
    // (sw.js posts the target URL instead of opening a duplicate tab)
    usePushNotificationNavigation()
    // Mirrors the unread total onto the PWA's app-icon badge (Badging API)
    useAppBadge()
    // Sweeps tray notifications for channels/threads that are no longer unread
    useClearReadNotifications()
    // Tears down state for channels that vanish from the channel list (deleted /
    // access lost): message store + socket room, stale last-visited, and a
    // redirect off the dead route if it's on screen
    useRemovedChannelCleanup()

    if (!isReady) {
        return <MainPageSkeleton />
    }

    return <>
        <DocumentTitle />
        {import.meta.env.VITE_NATIVE && <Suspense fallback={null}><NativeBridge /></Suspense>}
        {children}
        <CommandMenu />
        <AttachmentPreviewModal />
        {/* "App was updated — refresh" prompt (chunk failures, deploys, SW updates) */}
        <AppUpdateAlert />
        <SessionBroadcast />
    </>
}

/** If opened on a desktop, show the primary sidebar at all times. If on mobile, don't show the sidebar at all - bottom bars will be controlled by the respective page */
const AppShellLayout = ({ children }: { children: React.ReactNode }) => {

    const isMobile = useIsMobile()
    const online = useOnlineStatus()
    // The banner takes the top inset while it shows, so its colour fills the status bar.
    const banner = !online && (
        <div className="shrink-0 bg-surface-gray-3 py-1 text-center text-sm text-ink-gray-7 standalone:pt-[calc(var(--inset-top)+0.25rem)]">{_("You're offline")}</div>
    )
    const topInset = online ? "standalone:pt-[var(--inset-top)]" : ""

    if (isMobile) {
        return <div className={cn("flex h-dvh flex-col overflow-hidden", topInset)}>
            {banner}
            {children}
        </div>
    }

    return <div className="flex h-dvh overflow-hidden bg-surface-elevation-1">
        <PrimarySidebar />
        <RavenSettingsDialog />
        <main className={cn("flex min-w-0 flex-1 flex-col", topInset)}>
            {banner}
            {children}
        </main>
    </div>
}

export default AppShell