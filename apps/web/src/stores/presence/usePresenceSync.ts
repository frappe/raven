import { useEffect } from "react"
import { useFrappeEventListener, useFrappeGetCall } from "frappe-react-sdk"
import { presenceStore } from "./store"

type ActiveStateEvent = { user: string; active: boolean }

/**
 * Seeds and maintains the presence store. Mounted once at the app shell.
 *
 * Seeds the online set from get_active_users (reseeding on reconnect, which also
 * recovers any presence changes missed while disconnected), and applies each
 * raven:user_active_state_updated event live. The event broadcasts to everyone,
 * so socket.on receives it without any room subscription.
 */
export const usePresenceSync = () => {
    const { data } = useFrappeGetCall<{ message: string[] }>(
        "raven.api.user_availability.get_active_users",
        undefined,
        "active_users",
        {
            dedupingInterval: 1000 * 60 * 5,
            revalidateOnReconnect: true,
            revalidateOnFocus: true,
            focusThrottleInterval: 60_000,
        },
    )

    useEffect(() => {
        if (data?.message) presenceStore.setActiveUsers(data.message)
    }, [data])

    useFrappeEventListener("raven:user_active_state_updated", (event: ActiveStateEvent) => {
        if (!event?.user) return
        presenceStore.setUserActive(event.user, !!event.active)
    })
}
