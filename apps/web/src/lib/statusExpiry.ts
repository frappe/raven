import dayjs, { type Dayjs } from "dayjs"
import type { UserData } from "@db"
import { formatTimeLabel } from "@lib/timeUtils"
import _ from "@lib/translate"
import type { TimeFormat } from "@utils/preferences"

// End times for availability and the written status. Stored as naive server-timezone
// strings, which compare chronologically as text.

export type StatusDurationId = "30m" | "1h" | "4h" | "today" | "week" | "custom" | "never"

/** The "Clear after" choices, in menu order. */
export const getStatusDurations = (): { id: StatusDurationId; label: string }[] => [
    { id: "30m", label: _("30 minutes") },
    { id: "1h", label: _("1 hour") },
    { id: "4h", label: _("4 hours") },
    { id: "today", label: _("Today") },
    { id: "week", label: _("This week") },
    { id: "custom", label: _("Choose date and time…") },
    { id: "never", label: _("Don't clear") },
]

/** Local end time for a fixed duration. "This week" ends Sunday night, including on Sunday. */
export const getDurationEnd = (id: Exclude<StatusDurationId, "custom" | "never">, now: Dayjs = dayjs()): Dayjs => {
    switch (id) {
        case "30m":
            return now.add(30, "minute")
        case "1h":
            return now.add(1, "hour")
        case "4h":
            return now.add(4, "hour")
        case "today":
            return now.endOf("day")
        case "week":
            return (now.day() === 0 ? now : now.day(7)).endOf("day")
    }
}

/** "Until 3:30 PM" later today, "Until Fri" within 6 days, "Until 3 Dec" beyond. */
export const formatStatusUntil = (end: Dayjs, timeFormat: TimeFormat, now: Dayjs = dayjs()): string => {
    const days = end.startOf("day").diff(now.startOf("day"), "day")
    if (days === 0) return _("Until {0}", [formatTimeLabel(end.format("HH:mm"), timeFormat)])
    if (days <= 6) return _("Until {0}", [end.format("ddd")])
    return _("Until {0}", [end.format("D MMM")])
}

/** At or past its end time, matching the server sweep. No end time never expires. */
export const isExpired = (expiresAt: string | null | undefined, nowServer: string) =>
    !!expiresAt && expiresAt <= nowServer

export type EffectiveStatus = {
    availability: NonNullable<UserData["availability_status"]>
    availabilityEndsAt: string | null
    customStatus: string
    customStatusEndsAt: string | null
}

/** The user's status with expired parts cleared, before the sweep reaches them. */
export const getEffectiveStatus = (user: UserData, nowServer: string): EffectiveStatus => {
    const availabilityLive = !isExpired(user.availability_expires_at, nowServer)
    const customStatusLive = !isExpired(user.custom_status_expires_at, nowServer)
    return {
        availability: (availabilityLive && user.availability_status) || "",
        availabilityEndsAt: (availabilityLive && user.availability_expires_at) || null,
        customStatus: (customStatusLive && user.custom_status) || "",
        customStatusEndsAt: (customStatusLive && user.custom_status_expires_at) || null,
    }
}
