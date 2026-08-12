import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext, useSWRConfig } from "frappe-react-sdk"
import { UNREAD_NOTIFICATION_IDS_KEY } from "@hooks/useNotifications"
import { useStickyThenLeave } from "@hooks/useStickyThenLeave"
import { subscribeConnectionEpoch } from "@stores/connectionFreshness"
import { notificationListStore, type NotificationFilters, type NotificationTab } from "./store"
import { unreadNotificationsStore } from "./unreadStore"
import { selectNotificationRows } from "./selectors"
import type { NotificationObject } from "./reducers"
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
export const useNotificationList = (
    type: NotificationTab,
    { unreadOnly, activeMessageID }: { unreadOnly: boolean; activeMessageID?: string },
) => {
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

    // Only EXPLICIT actions enter the leave pipeline: clicking a notification
    // open, swiping it read, or Mark all as read — all of which pass through the
    // handlers below, which record the message ids here. Rows read PASSIVELY
    // (their message scrolled into view in the side pane while the user read
    // something else) never leave — they just render as read. The departure
    // animation is a receipt for something the user did; several rows vanishing
    // because of a scroll reads as a bug. Reset synchronously on view change,
    // like the pipeline's own state.
    const explicitlyReadRef = useRef<Set<string>>(new Set())
    // Of the explicit reads, the ones done by SWIPE — those skip the pipeline's
    // linger and exit immediately (the swipe already carried the row off-screen).
    const swipedRef = useRef<Set<string>>(new Set())
    const explicitViewKeyRef = useRef(viewKey)
    if (explicitViewKeyRef.current !== viewKey) {
        explicitViewKeyRef.current = viewKey
        explicitlyReadRef.current = new Set()
        swipedRef.current = new Set()
    }

    // Sticky-then-leave unread view — the shared pipeline (see useStickyThenLeave
    // for the full contract). The open notification is exempt while it stays open.
    const leave = useStickyThenLeave<NotificationObject>({
        viewKey,
        enabled: unreadOnly,
        getId: (row) => row.name,
        shouldLeave: (row) => !!row.is_read && explicitlyReadRef.current.has(row.message_id),
        isOpen: (row) => !!activeMessageID && row.message_id === activeMessageID,
        leaveImmediately: (row) => swipedRef.current.has(row.message_id),
    })

    const rows = useMemo(() => {
        const selected = selectNotificationRows(state, { type, unreadOnly, keepIds: leave.keepIds })
        if (unreadOnly) {
            for (const row of selected) {
                if (!row.is_read) leave.keepIds.add(row.name)
            }
        }
        return selected
        // eslint-disable-next-line react-hooks/exhaustive-deps -- leave.version IS the keepIds dependency
    }, [state, type, unreadOnly, leave.keepIds, leave.version])
    leave.onRows(rows)


    const loadMore = useCallback(() => {
        loadMoreNotifications(client, viewKey, filters)
    }, [client, viewKey, filters])

    // Optimistic update + POST only. The server fires message_notifications_read /
    // all_notifications_read back to us (user-scoped), and useNotificationsRealtime
    // applies that echo to the unread-id store (idempotent after our optimistic write).
    // On failure there's no echo, so we reconcile the page + the id set.
    const markMessageRead = useCallback(
        (messageId: string, options?: { expedite?: boolean }) => {
            // Both explicit gestures (click-open, swipe-read) land here — recording
            // the id is what admits the row to the leave pipeline above. A swipe
            // passes expedite: its row exits without the linger.
            if (options?.expedite) swipedRef.current.add(messageId)
            explicitlyReadRef.current.add(messageId)
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

    // Manual refresh (pull-to-refresh): refetch the first page of this view and
    // revalidate the unread-id set. reconcileFirstPage is already coalesced, so
    // a pull during a running reconcile just queues one follow-up.
    const refresh = useCallback(async () => {
        await reconcileFirstPage(client, viewKey, filters)
        await globalMutate(UNREAD_NOTIFICATION_IDS_KEY)
    }, [client, viewKey, filters, globalMutate])

    const markAllRead = useCallback(() => {
        // A bulk action clears the view INSTANTLY — no linger, no per-row exit
        // (leave.clearNow keeps only the open notification, which departs
        // per-row later; marking it explicit here is what lets it).
        if (activeMessageID) explicitlyReadRef.current.add(activeMessageID)
        leave.clearNow()
        notificationListStore.markAllRead() // optimistic
        unreadNotificationsStore.clear()
        client
            .post("raven.api.notifications.mark_all_notifications_read")
            .catch(() => globalMutate(UNREAD_NOTIFICATION_IDS_KEY))
        // eslint-disable-next-line react-hooks/exhaustive-deps -- leave.clearNow reads live state through refs
    }, [client, globalMutate, activeMessageID, leave.clearNow])

    return {
        rows,
        /** Rows mid-exit — the page passes this down so they render collapsed. */
        leavingIds: leave.leavingIds,
        isLoading: state.status === "idle" || state.status === "loading",
        error: state.status === "error" ? state.error : null,
        hasMore: state.hasMore,
        loadMore,
        refresh,
        markMessageRead,
        markAllRead,
    }
}
