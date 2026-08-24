import dayjs from 'dayjs'
import _ from '@lib/translate'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(advancedFormat)
dayjs.extend(relativeTime)

const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

/** Guarded: window is absent in tests/SSR */
const frappeBoot = typeof window !== 'undefined' ? window.frappe?.boot : undefined

export const SYSTEM_TIMEZONE = frappeBoot?.time_zone?.system || DEFAULT_TIME_ZONE


export const USER_DATE_FORMAT = (frappeBoot?.user?.defaults?.date_format?.toUpperCase() || frappeBoot?.sysdefaults?.date_format?.toUpperCase()
    || 'DD/MM/YYYY')

export const FRAPPE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
export const FRAPPE_DATE_FORMAT = 'YYYY-MM-DD'
export const FRAPPE_TIME_FORMAT = 'HH:mm:ss'

export const formatDate = (date?: string | Date, format?: string) => {
  if (!format) {
    format = USER_DATE_FORMAT
  }

  if (date) {
    return dayjs(date).format(format)
  }
  return ""
}

export const getDateObject = (timestamp: string): dayjs.Dayjs => {

    return dayjs.tz(timestamp, SYSTEM_TIMEZONE).local()
}

export const convertMillisecondsToReadableDate = (timestampInMilliseconds: number, format: string = 'hh:mm A (Do MMM)') => {

    return dayjs.unix(timestampInMilliseconds / 1000)
}

// Convert a Date object to Frappe datetime format string
export const convertDateToTimeString = (date: Date): string => {
    return dayjs(date).format(FRAPPE_DATETIME_FORMAT)
}

/**
 * Compact timestamp for sidebar/list rows, chat-app convention:
 * today → "9:34 AM", yesterday → "Yesterday", within the week → "Tuesday",
 * this year → "Jun 2", older → "Jun 2, 2025". ("3 days ago"-style relative
 * phrasing is too wordy for that slot.)
 */
export const formatRelativeDate = (timestamp?: string) => {
  if (!timestamp) return ""
  const d = getDateObject(timestamp)
  const startOfToday = dayjs().startOf("day")
  if (d.isAfter(startOfToday)) return d.format("h:mm A")
  if (d.isAfter(startOfToday.subtract(1, "day"))) return _("Yesterday")
  if (d.isAfter(startOfToday.subtract(6, "day"))) return d.format("dddd")
  if (d.isSame(dayjs(), "year")) return d.format("MMM D")
  return d.format("MMM D, YYYY")
}

/**
 * Utility function to convert a date string to a Date object
 * @param date
 * @returns
 */
export const toDate = (date: string, format: string = "YYYY-MM-DD") => {
  return dayjs(date, format).toDate()
}