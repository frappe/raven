import dayjs, { Dayjs } from "dayjs"
import { SYSTEM_TIMEZONE, FRAPPE_DATETIME_FORMAT } from "@lib/date"
import _ from "@lib/translate"

type ScheduleMenuSlot = { label: string; time: Dayjs }
type ScheduleMenuSection = { label: string; slots: ScheduleMenuSlot[] }

/** Dropdown label for an arbitrary HH:mm — 24-hour clock (frappe-ui convention),
 *  so the label IS the value, e.g. "22:15". Kept as a function so off-grid times
 *  (an edited row not on the 15-min grid) get their label the same way. */
export const formatTimeLabel = (hhmm: string) => hhmm

/**
 * 96 quarter-hour time options for the schedule time Selects: 24-hour HH:mm
 * labels and values. Single source of truth, shared by ScheduleTimePicker and
 * the scheduled-message editors.
 */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_v, i) => {
    const hour = Math.floor(i / 4)
    const minute = (i % 4) * 15
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    return { label: formatTimeLabel(value), value }
})

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

/** Local pick → the naive server-timezone datetime string the backend stores
 *  (same convention as `optimisticNow()` in the message sender). */
export const toServerDatetime = (local: Dayjs) => local.tz(SYSTEM_TIMEZONE).format(FRAPPE_DATETIME_FORMAT)

/** Stored naive server-tz datetime → local Dayjs, for rendering rows.
 *  Reuses `getDateObject` from `@lib/date`. */
export { getDateObject as fromServerDatetime } from "@lib/date"

/** A confirmed custom pick: server-side naive datetime + human label for toasts. */
export type SchedulePick = { serverTime: string; label: string }

/**
 * The quarter-hour options still in the FUTURE for the given date: the full list for any
 * other day, only the not-yet-passed slots when the date is today. Time pickers use
 * this so "today" never offers a slot the backend would reject as past.
 */
export const getAvailableTimeOptions = (date: Date | Dayjs, now: Dayjs = dayjs()) => {
    const day = dayjs(date)
    const options = TIME_OPTIONS
    if (!day.isSame(now, "day")) return options
    return options.filter(({ value }) => {
        const [hours, minutes] = value.split(":").map(Number)
        return day.hour(hours).minute(minutes).isAfter(now)
    })
}

/** Human label for toasts and list rows, e.g. "Mon, Aug 11 at 9:00 AM". */
export const formatScheduleLabel = (time: Dayjs) =>
    // The year only earns its place when it isn't this year — "Aug 12 at 9:00 AM"
    // and "Aug 12, 2027 at 9:00 AM" must not read identically.
    time.format(time.year() === dayjs().year() ? "ddd, MMM D [at] h:mm A" : "ddd, MMM D, YYYY [at] h:mm A")
