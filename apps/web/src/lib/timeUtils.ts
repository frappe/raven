import dayjs, { Dayjs } from "dayjs"
import { SYSTEM_TIMEZONE, FRAPPE_DATETIME_FORMAT } from "@lib/date"
import type { TimeFormat } from "@utils/preferences"
import _ from "@lib/translate"

// Future-time picking, shared by reminders and schedule-send. Every helper here is
// pure dayjs + i18n, and every clock label takes the user's time format.

/** The dayjs pattern for a clock time in the user's preferred format. */
const clockFormat = (timeFormat: TimeFormat) => (timeFormat === "12-hour" ? "h:mm A" : "HH:mm")

/** Label for an HH:mm value in the user's time format: "9:15 PM" or "21:15". */
export const formatTimeLabel = (hhmm: string, timeFormat: TimeFormat) =>
    dayjs(`2000-01-01T${hhmm}`).format(clockFormat(timeFormat))

/** The 96 quarter-hour slot values, "00:00" to "23:45". */
export const TIME_VALUES = Array.from({ length: 96 }, (_v, i) => {
    const hour = Math.floor(i / 4)
    const minute = (i % 4) * 15
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
})

/**
 * Select options still in the future for the date — "today" never offers a past slot.
 * `include` adds one off-grid HH:mm to the list (sorted in), so an existing time that
 * sits on the 5-minute sweep grid stays selectable when a reminder is edited.
 */
export const getAvailableTimeOptions = (
    date: Date | Dayjs,
    timeFormat: TimeFormat,
    now: Dayjs = dayjs(),
    include?: string,
) => {
    const day = dayjs(date)
    // HH:mm strings sort correctly as text.
    const values = include && !TIME_VALUES.includes(include) ? [...TIME_VALUES, include].sort() : TIME_VALUES
    const future = day.isSame(now, "day")
        ? values.filter((value) => {
            const [hours, minutes] = value.split(":").map(Number)
            return day.hour(hours).minute(minutes).isAfter(now)
        })
        : values
    return future.map((value) => ({ value, label: formatTimeLabel(value, timeFormat) }))
}

/** Local pick → the naive server-timezone datetime string the backend stores. */
export const toServerDatetime = (local: Dayjs) => local.tz(SYSTEM_TIMEZONE).format(FRAPPE_DATETIME_FORMAT)

/** Stored naive server-tz datetime → local Dayjs, for rendering rows. */
export { getDateObject as fromServerDatetime } from "@lib/date"

/** Human label for toasts and list rows, e.g. "Mon, Aug 11 at 9:00 AM" or "Mon, Aug 11 at 21:00". */
export const formatDateTimeLabel = (time: Dayjs, timeFormat: TimeFormat) => {
    // The year only earns its place when it isn't this year.
    const day = time.year() === dayjs().year() ? "ddd, MMM D" : "ddd, MMM D, YYYY"
    return time.format(`${day} [at] ${clockFormat(timeFormat)}`)
}

/** The delivery sweeps run every 5 minutes; times off that grid fire late.
 *  Ceil onto a grid so times fire exactly when they say — presets use the
 *  sweep's 5-minute grid, dialog seeds use their Select's 15-minute slots. */
export const ceilToStep = (time: Dayjs, stepMinutes: number) => {
    const floored = time.minute(time.minute() - (time.minute() % stepMinutes)).second(0).millisecond(0)
    return floored.isSame(time) ? floored : floored.add(stepMinutes, "minute")
}

// --- Reminders ---

export type ReminderPreset = { id: string; label: string; time: Dayjs }

/** One-tap presets, sweep-grid aligned. Monday slot only on Fri/Sat —
 *  Sunday's Tomorrow IS Monday, and midweek it's noise. */
export const getReminderPresets = (timeFormat: TimeFormat, now: Dayjs = dayjs()): ReminderPreset[] => {
    const at9 = (day: Dayjs) => day.hour(9).minute(0).second(0).millisecond(0)
    const nine = formatTimeLabel("09:00", timeFormat)
    const presets: ReminderPreset[] = [
        { id: "20m", label: _("In 20 minutes"), time: ceilToStep(now.add(20, "minute"), 5) },
        { id: "1h", label: _("In 1 hour"), time: ceilToStep(now.add(1, "hour"), 5) },
        { id: "3h", label: _("In 3 hours"), time: ceilToStep(now.add(3, "hour"), 5) },
        { id: "tomorrow", label: _("Tomorrow at {0}", [nine]), time: at9(now.add(1, "day")) },
    ]
    if (now.day() === 5 || now.day() === 6) {
        presets.push({
            id: "next-week",
            label: _("Monday at {0}", [nine]),
            time: at9(now.add(now.day() === 5 ? 3 : 2, "day")),
        })
    }
    return presets
}

// --- Schedule send ---

export type ScheduleSlotId = "morning" | "afternoon" | "evening"
export type ScheduleMenuSlot = { id: ScheduleSlotId; label: string; time: Dayjs }
export type ScheduleMenuSection = { label: string; slots: ScheduleMenuSlot[] }

/** A confirmed custom pick: server-side naive datetime + human label for toasts. */
export type SchedulePick = { serverTime: string; label: string }

/** Preset slot times-of-day (local tz). Labels are thunks: _() at module scope
 *  would resolve before i18n loads. */
const SLOT_TIMES: { id: ScheduleSlotId; label: () => string; hour: number }[] = [
    { id: "morning", label: () => _("Morning"), hour: 9 },
    { id: "afternoon", label: () => _("Afternoon"), hour: 13 },
    { id: "evening", label: () => _("Evening"), hour: 18 },
]

/** Today / Tomorrow / next-working-day preset sections for the schedule submenu.
 *  Past Today slots are dropped (an empty Today is omitted). The next working day
 *  comes from the server (Holiday List aware) and is skipped when it IS tomorrow. */
export const getScheduleMenuSections = (now: Dayjs = dayjs(), nextWorkingDay?: Dayjs | null): ScheduleMenuSection[] => {
    const dayFor = (base: Dayjs) =>
        SLOT_TIMES.map(({ id, label, hour }) => ({ id, label: label(), time: base.hour(hour).minute(0).second(0).millisecond(0) }))
    const tomorrow = now.add(1, "day")
    const sections = [
        { label: _("Today"), slots: dayFor(now).filter((s) => s.time.isAfter(now)) },
        { label: _("Tomorrow"), slots: dayFor(tomorrow) },
    ]
    if (nextWorkingDay && !nextWorkingDay.isSame(tomorrow, "day")) {
        // Weekday plus date, "Monday, 3 Jan": the name alone is ambiguous after a long break.
        sections.push({ label: nextWorkingDay.format("dddd, D MMM"), slots: dayFor(nextWorkingDay) })
    }
    return sections.filter((s) => s.slots.length > 0)
}
