import { useEffect } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import { leaveStore } from "./store"

const isHRInstalled = () => window?.frappe?.boot?.versions?.hrms !== undefined

/**
 * Seeds the leave store from get_all_users_on_leave (today's on-leave user ids).
 * Mounted once at the app shell.
 *
 * Leave is a daily fact, not a realtime one — there's no socket event — so a long
 * deduping interval (+ revalidate on reconnect) is enough. Skipped entirely when
 * HRMS isn't installed (the API just returns [], so don't bother calling). The
 * backend also gates on the `show_if_a_user_is_on_leave` Raven Setting; when that's
 * off the list is empty and every useIsUserOnLeave reads false.
 */
export const useLeaveSync = () => {
    const { data } = useFrappeGetCall<{ message: string[] }>(
        "raven.api.raven_users.get_all_users_on_leave",
        undefined,
        isHRInstalled() ? "users_on_leave" : null,
        {
            dedupingInterval: 1000 * 60 * 60 * 6,
            focusThrottleInterval: 1000 * 60 * 60 * 6,
            revalidateOnReconnect: true,
        },
    )

    useEffect(() => {
        if (data?.message) leaveStore.setUsersOnLeave(data.message)
    }, [data])
}
