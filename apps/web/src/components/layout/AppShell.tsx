import { MainPageSkeleton } from "@components/features/main-page/MainPageSkeleton"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { useIsMobile } from "@hooks/use-mobile"
import { useLoadUsers } from "@hooks/useLoadUsers"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"
import { AlertCircle } from "lucide-react"
import { Outlet } from "react-router"
import PrimarySidebar from "./PrimarySidebar/PrimarySidebar"
import CommandMenu from "@components/features/cmdk/CommandMenu"
import { AttachmentPreviewModal } from "@components/features/message/renderers/AttachmentPreviewModal"
import { useUnreadSync } from "@stores/unread/useUnreadSync"
import { useUnreadRealtime } from "@stores/unread/useUnreadRealtime"
import { useMessageRoomSubscriptions } from "@stores/messages/useMessageRoomSubscriptions"
import { useMessagesRealtime } from "@stores/messages/useMessagesRealtime"
import { useReconnectCatchup } from "@stores/messages/useReconnectCatchup"
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
import { useReportActiveState } from "@stores/presence/useReportActiveState"
import DocumentTitle from "./DocumentTitle"
import RavenSettingsDialog from "@components/features/settings/SettingsDialog"

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
            </AppListeners>
        </ProtectedRoute>
    )
}

/** Check if the user has the Raven User role */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {

    const hasRavenUserRole = hasRole('Raven User')

    if (!hasRavenUserRole) {
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
    // Health-checks the socket on focus and force-reconnects a dead one (e.g. after a
    // backgrounded tab suspended it) — the reconnect then drives useReconnectCatchup
    useActiveSocketConnection()
    // Backstop: refetch messages missed during a disconnect when the socket reconnects
    useReconnectCatchup()
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
    // unread-count badge live (page + sidebar), even when the Notifications page is closed.
    useNotificationsRealtime()
    // TODO: Push notification listener
    // TODO: App update listener

    if (!isReady) {
        return <MainPageSkeleton />
    }

    return <>
        <DocumentTitle />
        {children}
        <CommandMenu />
        <AttachmentPreviewModal />
    </>
}

/** If opened on a desktop, show the primary sidebar at all times. If on mobile, don't show the sidebar at all - bottom bars will be controlled by the respective page */
const AppShellLayout = ({ children }: { children: React.ReactNode }) => {

    const isMobile = useIsMobile()

    if (isMobile) {
        return <div className="flex h-dvh flex-col overflow-hidden">
            {children}
        </div>
    }

    return <div className="flex h-dvh overflow-hidden bg-surface-elevation-1">
        <PrimarySidebar />
        <RavenSettingsDialog />
        <main className="flex min-w-0 flex-1 flex-col">
            {children}
        </main>
    </div>
}

export default AppShell