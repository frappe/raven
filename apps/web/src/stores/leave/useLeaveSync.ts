import { useEffect } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import dayjs from "dayjs"
import { SYSTEM_TIMEZONE } from "@lib/date"
import { isHRInstalled } from "@lib/apps"
import { leaveStore } from "./store"

const SIX_HOURS = 1000 * 60 * 60 * 6

// Module-level on purpose: touches only module singletons, so it has no
// business inside the render cycle. (Same shape as useUnreadSync.)
const applyUsersOnLeave = (userIDs: string[] | undefined) => {
    if (userIDs) leaveStore.setUsersOnLeave(userIDs)
}

/** The org's current calendar day. Leave flips at the SERVER's midnight, so
 *  staleness is measured against the org clock, not the device clock. */
const orgDay = (): string => {
    try {
        return dayjs().tz(SYSTEM_TIMEZONE).format("YYYY-MM-DD")
    } catch {
        return dayjs().format("YYYY-MM-DD")
    }
}

/**
 * When this page load last synced successfully. Module-level, not a ref: a
 * StrictMode remount is cache-served (no fetch, no onSuccess), and a fresh
 * ref would read null forever — this survives the remount.
 */
let lastSync: { at: number; day: string } | null = null

/**
 * Seeds the leave store from get_all_users_on_leave (today's on-leave user ids).
 * Mounted once at the app shell.
 *
 * Division of labor: SWR owns the fetch lifecycle — the mount fetch, reconnect
 * revalidation (deduped to 6h), the persisted cache's instant seed on reload,
 * and onSuccess. FRESHNESS is ours: leave is a daily fact with no socket event,
 * so one focus/visibility listener applies the whole policy — refetch when the
 * data is older than 6h or from a previous org day. mutate() bypasses SWR's
 * dedupe, so this check is the only throttle on the focus path. (A tab left
 * visible and untouched across midnight gets no event; it catches up on the
 * first interaction.)
 *
 * Skipped entirely when HRMS isn't installed (the API just returns [], so don't
 * bother calling). The backend also gates on the `show_if_a_user_is_on_leave`
 * Raven Setting; when that's off the list is empty and every useIsUserOnLeave
 * reads false.
 */
export const useLeaveSync = () => {
    const { data, mutate } = useFrappeGetCall<{ message: string[] }>(
        "raven.api.raven_users.get_all_users_on_leave",
        undefined,
        isHRInstalled() ? "users_on_leave" : null,
        {
            // Focus freshness is handled by the listener below, with its own rule.
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            // Throttles SWR-internal triggers (reconnect bursts) — mutate() is exempt.
            dedupingInterval: SIX_HOURS,
            onSuccess: (fetched) => {
                lastSync = { at: Date.now(), day: orgDay() }
                // Seed on every FETCH, not just on data change: a revalidation
                // whose payload deep-equals the cached one keeps the SAME data
                // reference, so the [data] effect below never re-fires then.
                // Same bug family as useUnreadSync.
                applyUsersOnLeave(fetched?.message)
            },
        },
    )

    // Still needed for cache-served data (a remount inside the deduping window,
    // and the persisted cache's instant value on reload — both give `data`
    // without a request, so onSuccess doesn't fire).
    useEffect(() => applyUsersOnLeave(data?.message), [data])

    useEffect(() => {
        if (!isHRInstalled()) return
        const maybeSync = () => {
            if (document.visibilityState !== "visible") return
            // No successful sync this page load (mount fetch failed or was
            // skipped) — a look at the app is the moment to try again.
            if (!lastSync) {
                mutate()
                return
            }
            if (lastSync.day !== orgDay() || Date.now() - lastSync.at > SIX_HOURS) mutate()
        }
        window.addEventListener("focus", maybeSync)
        document.addEventListener("visibilitychange", maybeSync)
        return () => {
            window.removeEventListener("focus", maybeSync)
            document.removeEventListener("visibilitychange", maybeSync)
        }
    }, [mutate])
}
