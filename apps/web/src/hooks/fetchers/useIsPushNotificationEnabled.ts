import { useFrappeGetCall } from "frappe-react-sdk"
import { isPushSupportedByBrowser, isRavenPushConfigured } from "@lib/push"

/**
 * Whether push notifications can work HERE: the site must be on Raven Cloud
 * (v3 dropped the Frappe Cloud relay — that stays v2-only), boot must carry the
 * Firebase config, and the browser must support web push (false in iOS Safari
 * tabs until the PWA is installed). Used to hide push toggles entirely.
 * Defaults to false while the server check loads, so gated UI appears once confirmed.
 */
export function useIsPushNotificationEnabled(): boolean {
    const { data } = useFrappeGetCall<{ message: boolean }>(
        "raven.api.notification.are_push_notifications_enabled",
        undefined,
        // Skip the call when the client can't do push anyway
        isPushSupportedByBrowser() && isRavenPushConfigured() ? undefined : null,
        { revalidateIfStale: true, revalidateOnFocus: false, revalidateOnReconnect: false },
    )
    return data?.message ? true : false
}
