import dayjs, { Dayjs } from "dayjs"
import { SYSTEM_TIMEZONE, FRAPPE_DATETIME_FORMAT } from "@lib/date"
import _ from "@lib/translate"

// Future-time picking, shared by reminders and schedule-send. One file, kept
// byte-identical on both feature branches so they merge cleanly and each
// works standalone — every helper here is pure dayjs + i18n.

/** Dropdown label for an arbitrary HH:mm — 24-hour clock (frappe-ui convention),
 *  so the label IS the value, e.g. "22:15". Kept as a function so off-grid times
 *  (an edited row not on the 15-min grid) get their label the same way. */
export const formatTimeLabel = (hhmm: string) => hhmm

/** 96 quarter-hour Select options (24h, label = value). */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_v, i) => {
    const hour = Math.floor(i / 4)
    const minute = (i % 4) * 15
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    return { label: formatTimeLabel(value), value }
})

/** Options still in the future for the date — "today" never offers a past slot. */
export const getAvailableTimeOptions = (date: Date | Dayjs, now: Dayjs = dayjs()) => {
    const day = dayjs(date)
    if (!day.isSame(now, "day")) return TIME_OPTIONS
    return TIME_OPTIONS.filter(({ value }) => {
        const [hours, minutes] = value.split(":").map(Number)
        return day.hour(hours).minute(minutes).isAfter(now)
    })
}

/** Local pick → the naive server-timezone datetime string the backend stores. */
export const toServerDatetime = (local: Dayjs) => local.tz(SYSTEM_TIMEZONE).format(FRAPPE_DATETIME_FORMAT)

/** Stored naive server-tz datetime → local Dayjs, for rendering rows. */
export { getDateObject as fromServerDatetime } from "@lib/date"

/** Human label for toasts and list rows, e.g. "Mon, Aug 11 at 9:00 AM". */
export const formatDateTimeLabel = (time: Dayjs) =>
    // The year only earns its place when it isn't this year.
    time.format(time.year() === dayjs().year() ? "ddd, MMM D [at] h:mm A" : "ddd, MMM D, YYYY [at] h:mm A")

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
export const getReminderPresets = (now: Dayjs = dayjs()): ReminderPreset[] => {
    const at9 = (day: Dayjs) => day.hour(9).minute(0).second(0).millisecond(0)
    const presets: ReminderPreset[] = [
        { id: "20m", label: _("In 20 minutes"), time: ceilToStep(now.add(20, "minute"), 5) },
        { id: "1h", label: _("In 1 hour"), time: ceilToStep(now.add(1, "hour"), 5) },
        { id: "3h", label: _("In 3 hours"), time: ceilToStep(now.add(3, "hour"), 5) },
        { id: "tomorrow", label: _("Tomorrow at 9:00"), time: at9(now.add(1, "day")) },
    ]
    if (now.day() === 5 || now.day() === 6) {
        presets.push({
            id: "next-week",
            label: _("Monday at 9:00"),
            time: at9(now.add(now.day() === 5 ? 3 : 2, "day")),
        })
    }
    return presets
}

// --- Schedule send ---

type ScheduleMenuSlot = { label: string; time: Dayjs }
type ScheduleMenuSection = { label: string; slots: ScheduleMenuSlot[] }

/** A confirmed custom pick: server-side naive datetime + human label for toasts. */
export type SchedulePick = { serverTime: string; label: string }

/** Preset slot times-of-day (local tz). Labels are thunks: _() at module scope
 *  would resolve before i18n loads. */
const SLOT_TIMES = [
    { label: () => _("Morning"), hour: 9 },
    { label: () => _("Afternoon"), hour: 13 },
    { label: () => _("Evening"), hour: 18 },
]

/** Today / Tomorrow preset sections for the schedule submenu. Past Today slots are dropped;
 *  an empty Today section is omitted entirely. On Friday/Saturday a Monday-Morning section is
 *  appended after Tomorrow (always future, so it survives the empty-section filter); Sunday
 *  needs no such section — Tomorrow IS Monday. */
export const getScheduleMenuSections = (now: Dayjs = dayjs()): ScheduleMenuSection[] => {
    const dayFor = (base: Dayjs) =>
        SLOT_TIMES.map(({ label, hour }) => ({ label: label(), time: base.hour(hour).minute(0).second(0).millisecond(0) }))
    const sections = [
        { label: _("Today"), slots: dayFor(now).filter((s) => s.time.isAfter(now)) },
        { label: _("Tomorrow"), slots: dayFor(now.add(1, "day")) },
    ]
    // Weekend: the next useful delivery day is Monday morning — add it after Tomorrow.
    if (now.day() === 5 || now.day() === 6) {
        sections.push({
            label: _("Monday"),
            slots: [dayFor(now.add(now.day() === 5 ? 3 : 2, "day"))[0]],
        })
    }
    return sections.filter((s) => s.slots.length > 0)
}
