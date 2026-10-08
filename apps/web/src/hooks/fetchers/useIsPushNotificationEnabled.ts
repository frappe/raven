import { useFrappeGetCall } from "frappe-react-sdk"
import { isPushSupportedByBrowser, isRavenPushConfigured, initPushNotifications } from "@lib/push"

interface PushConfiguration {
    firebase_client_config?: string
    vapid_public_key?: string
}

const isReady = (configuration?: PushConfiguration) =>
    Boolean(configuration?.firebase_client_config && configuration?.vapid_public_key)

/** Discover background registration without requiring a first-login page reload. */
export function useIsPushNotificationEnabled(): boolean {
    const pending = window.frappe?.boot?.raven_cloud_push_setup_pending
    const { data } = useFrappeGetCall<{ message: PushConfiguration }>(
        "raven.api.notification.get_push_notification_config",
        undefined,
        isPushSupportedByBrowser() && (isRavenPushConfigured() || pending) ? undefined : null,
        {
            refreshInterval: (response) => pending && !isReady(response?.message) ? 5000 : 0,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            onSuccess: ({ message }) => {
                if (!pending || !isReady(message)) return
                Object.assign(window.frappe.boot, message, {
                    push_notification_service: "Raven", raven_cloud_push_setup_pending: false,
                })
                initPushNotifications()
            },
        },
    )
    return isReady(data?.message)
}
