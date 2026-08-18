import dayjs, { Dayjs } from "dayjs"
import { SYSTEM_TIMEZONE, FRAPPE_DATETIME_FORMAT } from "@lib/date"
import _ from "@lib/translate"

/** 96 quarter-hour Select options (24h, label = value). */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_v, i) => {
    const hour = Math.floor(i / 4)
    const minute = (i % 4) * 15
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    return { label: value, value }
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
export const formatReminderLabel = (time: Dayjs) =>
    // The year only earns its place when it isn't this year.
    time.format(time.year() === dayjs().year() ? "ddd, MMM D [at] h:mm A" : "ddd, MMM D, YYYY [at] h:mm A")

export type ReminderPreset = { id: string; label: string; time: Dayjs }

/** The delivery sweep runs every 5 minutes; times off that grid fire late.
 *  Ceil onto a grid so times fire exactly when they say — presets use the
 *  sweep's 5-minute grid, the dialog seed uses its Select's 15-minute slots. */
export const ceilToStep = (time: Dayjs, stepMinutes: number) => {
    const floored = time.minute(time.minute() - (time.minute() % stepMinutes)).second(0).millisecond(0)
    return floored.isSame(time) ? floored : floored.add(stepMinutes, "minute")
}

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
