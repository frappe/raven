import dayjs from "dayjs"
// Importing SYSTEM_TIMEZONE also guarantees lib/date ran its dayjs.extend
// calls — the tz plugin is registered before we use dayjs().tz() here.
import { SYSTEM_TIMEZONE } from "@lib/date"
import { getQuietHoursConfig, type TimeFormat } from "./preferences"

/**
 * "HH:MM:SS" (also "H:MM:SS" — a Python timedelta str drops the leading
 * zero) → seconds since midnight, or null when unparseable.
 */
const toSeconds = (hms: string): number | null => {
    const [hours, minutes, seconds] = hms.split(":").map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
    return hours * 3600 + minutes * 60 + (Number.isNaN(seconds) ? 0 : seconds)
}

/** A stored Time ("9:00:00" / "09:00:00") in the user's chosen time format —
 *  "9:00 AM" or "09:00". Empty string when unparseable. */
export const formatStoredTime = (stored: string | undefined, timeFormat: TimeFormat): string => {
    if (!stored) return ""
    const [hours, minutes] = stored.split(":").map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return ""
    return dayjs().hour(hours).minute(minutes).format(timeFormat === "12-hour" ? "h:mm A" : "HH:mm")
}

/** The org's working hours as a display range ("9:00 AM – 6:00 PM"), or null
 *  when not configured. Settings copy uses it so the hours are concrete, not
 *  abstract ("outside working hours" means little without the numbers). */
export const formatWorkingHoursRange = (timeFormat: TimeFormat): string | null => {
    const config = getQuietHoursConfig()
    if (!config) return null
    const start = formatStoredTime(config.working_hours_start, timeFormat)
    const end = formatStoredTime(config.working_hours_end, timeFormat)
    if (!start || !end) return null
    return `${start} – ${end}`
}

/**
 * When the CURRENT quiet period began, as epoch ms — i.e. the most recent
 * moment the org clock passed working_hours_end (every quiet stretch starts
 * when work ends, for normal and overnight windows alike). Null when quiet
 * hours aren't configured. Used to scope banner dismissals to one period:
 * "dismissed after this" = stays hidden until the NEXT quiet period.
 */
export const currentQuietPeriodStartMs = (): number | null => {
    const config = getQuietHoursConfig()
    if (!config) return null
    const end = toSeconds(config.working_hours_end)
    if (end === null) return null

    let orgClock: dayjs.Dayjs
    try {
        orgClock = dayjs().tz(SYSTEM_TIMEZONE)
    } catch {
        orgClock = dayjs()
    }
    const endToday = orgClock.startOf("day").add(end, "second")
    const periodStart = orgClock.isBefore(endToday) ? endToday.subtract(1, "day") : endToday
    return periodStart.valueOf()
}

/**
 * Whether it is currently OUTSIDE the org's working hours (= quiet hours).
 *
 * Measured on the org's clock — dayjs in SYSTEM_TIMEZONE (the site timezone
 * from boot) — so every member sees the same quiet window regardless of
 * device timezone. Handles working hours that wrap midnight (start > end,
 * e.g. a 22:00–06:00 shift). No config (feature off), start == end
 * (degenerate) or an unparseable value all read as NOT quiet — the feature
 * fails toward normal sends, never toward surprise silence.
 */
export const isInQuietHours = (): boolean => {
    const config = getQuietHoursConfig()
    if (!config) return false

    const start = toSeconds(config.working_hours_start)
    const end = toSeconds(config.working_hours_end)
    if (start === null || end === null || start === end) return false

    let orgClock: dayjs.Dayjs
    try {
        orgClock = dayjs().tz(SYSTEM_TIMEZONE)
    } catch {
        // Unresolvable timezone name — fall back to the device clock.
        orgClock = dayjs()
    }
    const now = orgClock.hour() * 3600 + orgClock.minute() * 60 + orgClock.second()

    const isWorking = start < end ? now >= start && now < end : now >= start || now < end
    return !isWorking
}
