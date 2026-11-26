import { useEffect } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import dayjs from "dayjs"
import { SYSTEM_TIMEZONE } from "@lib/date"
import { isHRInstalled } from "@lib/apps"
import { leaveStore, wfhStore } from "./store"

const SIX_HOURS = 1000 * 60 * 60 * 6

type HRDayStatus = { on_leave: string[]; work_from_home: string[] }

// Module-level on purpose: touches only module singletons, so it has no
// business inside the render cycle. (Same shape as useUnreadSync.)
const applyHRDayStatus = (status: HRDayStatus | undefined) => {
    if (!status) return
    leaveStore.setUsers(status.on_leave)
    wfhStore.setUsers(status.work_from_home)
}

/** The org's current calendar day. HR status flips at the SERVER's midnight, so
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
 * Seeds the leave and work-from-home stores from get_users_hr_day_status (today's
 * user ids for each). Mounted once at the app shell.
 *
 * Division of labor: SWR owns the fetch lifecycle — the mount fetch, reconnect
 * revalidation (deduped to 6h), and onSuccess. FRESHNESS is ours: HR status is a
 * daily fact with no socket event, so one focus/visibility listener applies the
 * whole policy — refetch when the data is older than 6h or from a previous org
 * day. mutate() bypasses SWR's dedupe, so this check is the only throttle on the
 * focus path. (A tab left visible and untouched across midnight gets no event; it
 * catches up on the first interaction.)
 *
 * Skipped entirely when HRMS isn't installed. The backend gates each list on its
 * Raven Setting; a list that's off comes back empty.
 */
export const useLeaveSync = () => {
    const { data, mutate } = useFrappeGetCall<{ message: HRDayStatus }>(
        "raven.api.raven_users.get_users_hr_day_status",
        undefined,
        isHRInstalled() ? "users_hr_day_status" : null,
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
                applyHRDayStatus(fetched?.message)
            },
        },
    )

    // Still needed for cache-served data: a remount inside the deduping window
    // gives `data` without a request, so onSuccess doesn't fire.
    useEffect(() => applyHRDayStatus(data?.message), [data])

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
