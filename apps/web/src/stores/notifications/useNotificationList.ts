import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext, useSWRConfig } from "frappe-react-sdk"
import { UNREAD_NOTIFICATION_IDS_KEY } from "@hooks/useNotifications"
import { subscribeConnectionEpoch } from "@stores/connectionFreshness"
import { notificationListStore, type NotificationFilters, type NotificationTab } from "./store"
import { unreadNotificationsStore } from "./unreadStore"
import { selectNotificationRows } from "./selectors"
import {
    loadInitialNotifications,
    loadMoreNotifications,
    reconcileFirstPage,
    reconcileViewIfStale,
    type NotificationCall,
} from "./loaders"

/**
 * Reads the notifications window for the active `type` (all/mention/reaction) + unread
 * toggle. Each filter combo is its OWN server-filtered, paginated window (keyed
 * `<type>[:unread]`), so the unread toggle and the tabs are complete and never stall.
 * The window is also filtered client-side so reading a notification removes it from the
 * unread view live; `loadMore` paginates the server slice lazily.
 */
export const useNotificationList = (type: NotificationTab, { unreadOnly }: { unreadOnly: boolean }) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as NotificationCall
    const { mutate: globalMutate } = useSWRConfig()

    const viewKey = `${type}${unreadOnly ? ":unread" : ""}`
    const filters: NotificationFilters = useMemo(
        () => ({ notificationType: type === "all" ? undefined : type, unreadOnly }),
        [type, unreadOnly],
    )

    const state = useSyncExternalStore(
        useCallback((onChange) => notificationListStore.subscribe(viewKey, onChange), [viewKey]),
        () => notificationListStore.getState(viewKey),
    )

    useEffect(() => {
        loadInitialNotifications(client, viewKey, filters)
    }, [client, viewKey, filters])

    // The load above heals staleness on OPEN — but the connection can also break
    // while the user is sitting on the page (lock the phone on it, come back).
    // While this view is mounted, reconcile as soon as a break is recorded.
    useEffect(
        () => subscribeConnectionEpoch(() => reconcileViewIfStale(client, viewKey, filters)),
        [client, viewKey, filters],
    )

    // Session-sticky unread view: a row the user is LOOKING at must not vanish the moment
    // it's read (clicked, or its message scrolled into view in the side pane) — the unread
    // filter applies to rows entering the view, not ones already displayed. Every row seen
    // unread in this view is remembered and survives the filter (rendered as read). Reset
    // synchronously when the tab/filter changes (an effect would leave one stale frame),
    // which re-applies the filter cleanly.
    const seenUnreadRef = useRef<Set<string>>(new Set())
    const seenViewKeyRef = useRef(viewKey)
    if (seenViewKeyRef.current !== viewKey) {
        seenViewKeyRef.current = viewKey
        seenUnreadRef.current = new Set()
    }

    const rows = useMemo(() => {
        const selected = selectNotificationRows(state, { type, unreadOnly, keepIds: seenUnreadRef.current })
        if (unreadOnly) {
            for (const row of selected) {
                if (!row.is_read) seenUnreadRef.current.add(row.name)
            }
        }
        return selected
    }, [state, type, unreadOnly])

    const loadMore = useCallback(() => {
        loadMoreNotifications(client, viewKey, filters)
    }, [client, viewKey, filters])

    // Optimistic update + POST only. The server fires message_notifications_read /
    // all_notifications_read back to us (user-scoped), and useNotificationsRealtime
    // applies that echo to the unread-id store (idempotent after our optimistic write).
    // On failure there's no echo, so we reconcile the page + the id set.
    const markMessageRead = useCallback(
        (messageId: string) => {
            notificationListStore.markMessageRead(messageId) // optimistic
            unreadNotificationsStore.remove([messageId]) // badge ticks down instantly
            client
                .post("raven.api.notifications.mark_message_notifications_read", { message_ids: [messageId] })
                .catch(() => {
                    reconcileFirstPage(client, viewKey, filters)
                    globalMutate(UNREAD_NOTIFICATION_IDS_KEY)
                })
        },
        [client, globalMutate, viewKey, filters],
    )

    const markAllRead = useCallback(() => {
        notificationListStore.markAllRead() // optimistic
        unreadNotificationsStore.clear()
        client
            .post("raven.api.notifications.mark_all_notifications_read")
            .catch(() => globalMutate(UNREAD_NOTIFICATION_IDS_KEY))
    }, [client, globalMutate])

    return {
        rows,
        isLoading: state.status === "idle" || state.status === "loading",
        error: state.status === "error" ? state.error : null,
        hasMore: state.hasMore,
        loadMore,
        markMessageRead,
        markAllRead,
    }
}
