import { useContext } from "react"
import { FrappeConfig, FrappeContext, useFrappeEventListener, useSWRConfig } from "frappe-react-sdk"
import { UNREAD_COUNT_KEY } from "@hooks/useNotifications"
import { notificationListStore } from "./store"
import { reconcileFirstPage, type NotificationCall } from "./loaders"

/**
 * Global notifications realtime, mounted once in AppListeners. The list-affecting events
 * carry no row data, so a new mention/reaction triggers a page-0 reconcile of every loaded
 * view that could contain it. The read events flip is_read in place across all views. Every
 * event also revalidates the shared unread-count key, keeping the sidebar + page badge live
 * even when the Notifications page is unmounted.
 */
export const useNotificationsRealtime = () => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as NotificationCall
    const { mutate: globalMutate } = useSWRConfig()

    // Reconcile page 0 of every loaded view that could hold this type (skip views filtered to
    // the other type). The reconcile is a no-op (same ref) where page 0 didn't change.
    const onNewNotification = (notificationType: "mention" | "reaction") => {
        for (const { viewKey, filters } of notificationListStore.loadedViews()) {
            if (filters.notificationType && filters.notificationType !== notificationType) continue
            reconcileFirstPage(client, viewKey, filters)
        }
        globalMutate(UNREAD_COUNT_KEY)
    }

    useFrappeEventListener("raven_mention", () => onNewNotification("mention"))
    useFrappeEventListener("raven_reaction_notification", () => onNewNotification("reaction"))

    useFrappeEventListener("message_notifications_read", (event: { message_id: string }) => {
        notificationListStore.markMessageRead(event.message_id)
        globalMutate(UNREAD_COUNT_KEY)
    })

    useFrappeEventListener("all_notifications_read", () => {
        notificationListStore.markAllRead()
        globalMutate(UNREAD_COUNT_KEY, { message: 0 }, { revalidate: false })
    })
}
