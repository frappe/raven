import type { RavenSchedulerEvent } from "@raven/types/RavenIntegrations/RavenSchedulerEvent"

/**
 * The doc plus the schedule as the form edits it. The cron expression is built from
 * these on save and split back into them on load.
 */
export type ScheduledMessageForm = RavenSchedulerEvent & {
    /** "HH:MM" from a native time input. Used by daily, weekly and monthly. */
    time: string
    /** Cron weekday numbers, "0" (Sunday) to "6" (Saturday). Weekly only. */
    days: string[]
    /** Day of the month, "1" to "31". Monthly only. */
    date: string
    /** A full five-part expression. Custom only. */
    cron: string
}

export const CRON_DEFAULTS = { time: "", days: [] as string[], date: "1", cron: "" }

export const WEEKDAYS = ["1", "2", "3", "4", "5"]
export const ALL_DAYS = ["1", "2", "3", "4", "5", "6", "0"]

const pad = (n: string) => n.padStart(2, "0")
const isNumber = (s: string) => /^\d+$/.test(s)

/** Split a saved cron expression into the form's schedule fields. */
export const toForm = (doc: ScheduledMessageForm): ScheduledMessageForm => {
    const expression = doc.cron_expression ?? ""
    const [minute = "", hour = "", date = "", , day = ""] = expression.split(" ")
    return {
        ...doc,
        time: isNumber(minute) && isNumber(hour) ? `${pad(hour)}:${pad(minute)}` : "",
        days: day.split(",").filter((d) => /^[0-6]$/.test(d)),
        date: isNumber(date) ? date : "1",
        cron: expression,
    }
}

/** Build the cron expression for the chosen frequency and drop the form-only fields before saving. */
export const fromForm = (values: ScheduledMessageForm): ScheduledMessageForm => {
    const { time, days, date, cron, ...doc } = values
    const [hh = "", mm = ""] = time.split(":")
    // Cron wants plain numbers, not the zero-padded ones a time input gives.
    const hour = String(Number(hh))
    const minute = String(Number(mm))
    let cron_expression = ""
    switch (values.event_frequency) {
        case "Every Day": cron_expression = `${minute} ${hour} * * *`; break
        case "Every Day of the week": cron_expression = `${minute} ${hour} * * ${[...days].map(Number).sort((a, b) => a - b).join(",")}`; break
        case "Date of the month": cron_expression = `${minute} ${hour} ${date} * *`; break
        case "Cron": cron_expression = cron.trim().split(/\s+/).join(" "); break
    }
    return { ...doc, cron_expression } as ScheduledMessageForm
}

/** True when the expression has the five cron fields and nothing else. */
export const isValidCron = (value: string) => /^\s*\S+(\s+\S+){4}\s*$/.test(value)
