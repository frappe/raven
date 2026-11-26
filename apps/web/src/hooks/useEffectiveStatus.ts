import { useLayoutEffect, useState } from "react"
import dayjs from "dayjs"
import type { UserData } from "@db"
import { getEffectiveStatus, type EffectiveStatus } from "@lib/statusExpiry"
import { fromServerDatetime, toServerDatetime } from "@lib/timeUtils"

// setTimeout fires at once past ~24.8 days, so a far end time waits in day-long steps.
const MAX_TIMER_MS = 1000 * 60 * 60 * 24

const serverNow = () => toServerDatetime(dayjs())

/**
 * The user's status with expired parts cleared, re-rendered when the nearest end time
 * passes, so a status ends on screen at its end time without waiting for the sweep.
 */
export function useEffectiveStatus(user: UserData | undefined): EffectiveStatus | undefined {
    // The clock is state, not read in render: the compiler memoizes on inputs. Reading it
    // costs ~30µs, so users without an end time skip it; "" keeps any later end unexpired
    // until its timer fires.
    const [now, setNow] = useState(() =>
        user?.availability_expires_at || user?.custom_status_expires_at ? serverNow() : "",
    )
    const status = user ? getEffectiveStatus(user, now) : undefined

    const a = status?.availabilityEndsAt
    const b = status?.customStatusEndsAt
    const nextEnd = a && b ? (a < b ? a : b) : a || b || null

    // Layout effect: data arriving already expired is re-checked before paint, never shown.
    useLayoutEffect(() => {
        if (!nextEnd) return
        const msToEnd = fromServerDatetime(nextEnd).diff(dayjs())
        if (msToEnd <= -1000) {
            setNow(serverNow())
            return
        }
        // A second past the end: the clock has whole seconds, so firing inside the end's own
        // second (fractional end, early timer) would read unexpired and never re-arm.
        const timer = setTimeout(() => setNow(serverNow()), Math.min(msToEnd + 1000, MAX_TIMER_MS))
        return () => clearTimeout(timer)
        // `now` re-arms the timer after a capped wait that changed nothing else.
    }, [nextEnd, now])

    return status
}
