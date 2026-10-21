import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useAtomValue } from "jotai"
import dayjs from "dayjs"
import cronstrue from "cronstrue"
import { Button } from "@components/ui/button"
import { FormDescription, FormItem, FormLabel, FormMessage } from "@components/ui/form"
import { DataField, LinkFormField, SelectFormField } from "@components/ui/form-elements"
import RichTextFormField from "@components/features/editor/RichTextFormField"
import { SelectItem } from "@components/ui/select"
import ChannelFormField from "@components/common/ChannelFormField"
import { SYSTEM_TIMEZONE } from "@lib/date"
import { timeFormatAtom } from "@utils/preferences"
import ServerScriptsCallout from "./ServerScriptsCallout"
import { ALL_DAYS, WEEKDAYS, isValidCron, type ScheduledMessageForm as FormValues } from "./cronSchedule"
import _ from "@lib/translate"

/** Chip order is Monday first; values are cron's numbering where Sunday is 0. */
const DAY_CHIPS: { value: string; short: string; long: string }[] = [
    { value: "1", short: _("Mon"), long: _("Monday") },
    { value: "2", short: _("Tue"), long: _("Tuesday") },
    { value: "3", short: _("Wed"), long: _("Wednesday") },
    { value: "4", short: _("Thu"), long: _("Thursday") },
    { value: "5", short: _("Fri"), long: _("Friday") },
    { value: "6", short: _("Sat"), long: _("Saturday") },
    { value: "0", short: _("Sun"), long: _("Sunday") },
]

const DATES = Array.from({ length: 31 }, (_, i) => String(i + 1))

/** Create/edit form for a Raven Scheduler Event. The schedule fields are joined into cron on save. */
export const ScheduledMessageForm = ({ isEdit }: { isEdit: boolean }) => {
    const { control } = useFormContext<FormValues>()
    const frequency = useWatch({ control, name: "event_frequency" })

    return (
        <div className="flex w-full flex-col gap-5">
            <ServerScriptsCallout />

            {/* The name is the record id, so it cannot change after creation. */}
            {!isEdit && (
                <DataField
                    name="event_name"
                    label={_("Name")}
                    isRequired
                    inputProps={{ placeholder: _("e.g. Sales Invoice - Daily Reminder"), autoFocus: true }}
                    rules={{
                        required: _("Name is required."),
                        maxLength: { value: 140, message: _("Name cannot be more than 140 characters.") },
                    }}
                />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <ChannelFormField
                    name="channel"
                    label={_("Where do you want to send this?")}
                    isRequired
                    placeholder={_("Select a channel")}
                    rules={{ required: _("Channel is required.") }}
                />
                <LinkFormField
                    name="bot"
                    label={_("Which agent should send this?")}
                    isRequired
                    doctype="Raven Bot"
                    placeholder={_("Select an agent")}
                    // Agents are created in the Agents tab, not on desk.
                    hideCreate
                    rules={{ required: _("Agent is required.") }}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <SelectFormField
                    name="event_frequency"
                    label={_("How often?")}
                    isRequired
                    rules={{ required: _("Frequency is required.") }}
                >
                    <SelectItem value="Every Day">{_("Daily")}</SelectItem>
                    <SelectItem value="Every Day of the week">{_("Weekly")}</SelectItem>
                    <SelectItem value="Date of the month">{_("Monthly")}</SelectItem>
                    <SelectItem value="Cron">{_("Custom")}</SelectItem>
                </SelectFormField>

                {frequency !== "Cron" && (
                    <DataField
                        name="time"
                        label={_("At what time?")}
                        isRequired
                        inputProps={{ type: "time" }}
                        rules={{
                            required: _("Time is required."),
                            pattern: { value: /^\d{2}:\d{2}$/, message: _("Enter a valid time.") },
                        }}
                    />
                )}
            </div>

            {frequency === "Every Day of the week" && <WeekdayChips />}

            {frequency === "Date of the month" && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <SelectFormField
                        name="date"
                        label={_("On which day of the month?")}
                        isRequired
                        rules={{ required: _("Day of the month is required.") }}
                        formDescription={_("Days past the 28th are skipped in shorter months.")}
                    >
                        {DATES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectFormField>
                </div>
            )}

            {frequency === "Cron" && (
                <DataField
                    name="cron"
                    label={_("Cron expression")}
                    isRequired
                    inputProps={{ placeholder: "30 9 * * 1-5", className: "font-mono", spellCheck: false }}
                    rules={{
                        required: _("Cron expression is required."),
                        validate: (v) => (isValidCron(v ?? "") ? true : _("Use five parts: minute, hour, day of month, month, day of week.")),
                    }}
                    formDescription={_("Minute, hour, day of month, month, day of week. Use * for any, lists like 1,3,5 and ranges like 1-5.")}
                />
            )}

            <ScheduleSummary />

            <RichTextFormField
                name="content"
                label={_("Message")}
                isRequired
                placeholder={_("e.g. Hello, this is a reminder to pay your dues.")}
                rules={{ required: _("Message is required.") }}
            />
        </div>
    )
}

/** Toggle chips for the days of the week, with quick picks for weekdays and every day. */
const WeekdayChips = () => {
    const { control } = useFormContext<FormValues>()
    return (
        <Controller
            control={control}
            name="days"
            rules={{ validate: (days) => (days?.length ? true : _("Pick at least one day.")) }}
            render={({ field, fieldState }) => {
                const selected = new Set(field.value ?? [])
                const toggle = (day: string) => {
                    const next = new Set(selected)
                    if (next.has(day)) next.delete(day)
                    else next.add(day)
                    field.onChange([...next])
                }
                const sameAs = (days: string[]) => days.length === selected.size && days.every((d) => selected.has(d))
                return (
                    <FormItem>
                        <FormLabel>{_("On which days?")}</FormLabel>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {DAY_CHIPS.map((day) => (
                                <Button
                                    key={day.value}
                                    type="button"
                                    size="sm"
                                    variant={selected.has(day.value) ? "solid" : "outline"}
                                    aria-pressed={selected.has(day.value)}
                                    aria-label={day.long}
                                    onClick={() => toggle(day.value)}
                                >
                                    {day.short}
                                </Button>
                            ))}
                            <span className="mx-1 h-5 w-px bg-outline-gray-2" aria-hidden="true" />
                            <Button type="button" size="sm" variant={sameAs(WEEKDAYS) ? "subtle" : "ghost"} onClick={() => field.onChange(WEEKDAYS)}>
                                {_("Weekdays")}
                            </Button>
                            <Button type="button" size="sm" variant={sameAs(ALL_DAYS) ? "subtle" : "ghost"} onClick={() => field.onChange(ALL_DAYS)}>
                                {_("Every day")}
                            </Button>
                        </div>
                        {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                    </FormItem>
                )
            }}
        />
    )
}

/** A plain-English line describing the schedule as currently filled in, plus the timezone it runs in. */
const ScheduleSummary = () => {
    const { control } = useFormContext<FormValues>()
    const [frequency, time, days, date, cron] = useWatch({ control, name: ["event_frequency", "time", "days", "date", "cron"] })
    const timeFormat = useAtomValue(timeFormatAtom)

    const formattedTime = time && /^\d{2}:\d{2}$/.test(time)
        ? dayjs(`2000-01-01T${time}`).format(timeFormat === "12-hour" ? "h:mm A" : "HH:mm")
        : null

    let summary: string | null = null
    if (frequency === "Cron") {
        summary = cron && isValidCron(cron) ? describeCron(cron, timeFormat === "24-hour") : null
    } else if (formattedTime) {
        if (frequency === "Every Day") {
            summary = _("Sent every day at {0}.", [formattedTime])
        } else if (frequency === "Every Day of the week") {
            const picked = DAY_CHIPS.filter((d) => days?.includes(d.value))
            if (picked.length === 7) summary = _("Sent every day at {0}.", [formattedTime])
            else if (picked.length === 5 && WEEKDAYS.every((d) => days?.includes(d))) summary = _("Sent every weekday at {0}.", [formattedTime])
            else if (picked.length > 0) summary = _("Sent every {0} at {1}.", [joinNames(picked.map((d) => d.long)), formattedTime])
        } else if (frequency === "Date of the month" && date) {
            summary = _("Sent on the {0} of every month at {1}.", [ordinal(Number(date)), formattedTime])
        }
    }

    return (
        <FormDescription>
            {summary && <span className="text-ink-gray-8">{summary} </span>}
            {_("Times are in the site timezone, {0}.", [SYSTEM_TIMEZONE])}
        </FormDescription>
    )
}

/** crontab.guru-style wording for a custom expression, or null when it cannot be read. */
const describeCron = (cron: string, use24Hour: boolean): string | null => {
    try {
        return cronstrue.toString(cron.trim(), { use24HourTimeFormat: use24Hour, throwExceptionOnParseError: true }) + "."
    } catch {
        return null
    }
}

const joinNames = (names: string[]) =>
    names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ${_("and")} ${names[names.length - 1]}`

const ordinal = (n: number) => {
    const rem10 = n % 10, rem100 = n % 100
    const suffix = rem10 === 1 && rem100 !== 11 ? "st" : rem10 === 2 && rem100 !== 12 ? "nd" : rem10 === 3 && rem100 !== 13 ? "rd" : "th"
    return `${n}${suffix}`
}

export default ScheduledMessageForm
