import { useState } from "react"
import dayjs from "dayjs"
import { Clock } from "lucide-react"
import { Button } from "@components/ui/button"
import { Calendar } from "@components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { getAvailableTimeOptions, TIME_OPTIONS, toServerDatetime, formatScheduleLabel, type SchedulePick } from "./scheduleTime"

type ScheduleTimePickerProps = {
    /** Fired when the user confirms the custom date + time. */
    onConfirm: (pick: SchedulePick) => void
    /** Renders a Cancel button beside the primary when provided (standard dialog footer). */
    onCancel?: () => void
    busy?: boolean
}

/**
 * Pick a future delivery time: a calendar date plus a half-hour time Select, with a
 * preview of the resulting datetime and a confirm button that stays disabled until
 * the pick is complete AND in the future. Pure content — the caller owns both the
 * overlay (if any) and the POST.
 */
export const ScheduleTimePicker = ({ onConfirm, onCancel, busy }: ScheduleTimePickerProps) => {
    const isMobile = useIsMobile()
    const [date, setDate] = useState<Date | undefined>(undefined)
    const [time, setTime] = useState("09:00")

    // Today hides already-passed slots; other days offer the full list. Picking
    // today can strand the selected time in the past — the effective time snaps
    // forward to the first still-available slot (derived, so the Select stays
    // controlled without mutating state on every date change).
    const availableOptions = date ? getAvailableTimeOptions(date) : TIME_OPTIONS
    const effectiveTime = availableOptions.some((option) => option.value === time) ? time : availableOptions[0]?.value
    const effectiveOption = availableOptions.find((option) => option.value === effectiveTime)

    // The effective date + time as a Dayjs, or null when incomplete or in the past.
    const [hours, minutes] = effectiveTime ? effectiveTime.split(":").map(Number) : [0, 0]
    const picked = date && effectiveTime ? dayjs(date).hour(hours).minute(minutes).second(0).millisecond(0) : null
    const pick = picked && picked.isAfter(dayjs()) ? picked : null

    return (
        // w-fit: the calendar is the widest child and defines the column, so the
        // full-width time Select and footer line up with it exactly on every screen.
        <div className="flex flex-col gap-2 w-fit mx-auto">
            <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={{ before: new Date() }}
                // Always render 6 week rows so switching months never changes the
                // calendar's height (5-row months would otherwise shift the layout).
                fixedWeeks
                // 44px date cells on mobile — fingers need more than the 32px default.
                // rounded-md: outside a popover/card the calendar paints its own
                // elevation-2 surface, whose square corners show in dark mode.
                className="rounded-md [--cell-size:--spacing(11)] md:[--cell-size:--spacing(8)]"
            />
            <Select value={effectiveTime ?? undefined} onValueChange={setTime} disabled={availableOptions.length === 0}>
                <SelectTrigger aria-label={_("Time")} className="w-full">
                    <Clock />
                    {/* Late tonight every slot may already be past — say so instead of crashing. */}
                    <SelectValue>{effectiveOption?.label ?? _("No times left today")}</SelectValue>
                </SelectTrigger>
                {/* px-3 + tabular-nums with the mobile height bump: fuller rows
                    with evenly spaced digits (frappe-ui's time-picker look). */}
                <SelectContent>
                    {availableOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="px-3 py-2 md:py-1.5 tabular-nums">
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {/* Standard dialog footer: Cancel beside the primary, right-aligned.
                Mobile: bigger touch targets, sharing the row edge-to-edge. */}
            <div className={isMobile ? "flex gap-2 pt-2 [&>*]:flex-1" : "flex justify-end gap-2 pt-2"}>
                {onCancel && (
                    <Button type="button" variant="outline" size={isMobile ? "lg" : "md"} disabled={busy} onClick={onCancel}>
                        {_("Cancel")}
                    </Button>
                )}
                <Button
                    type="button"
                    variant="solid"
                    size={isMobile ? "lg" : "md"}
                    loading={busy}
                    disabled={!pick}
                    onClick={() => pick && onConfirm({ serverTime: toServerDatetime(pick), label: formatScheduleLabel(pick) })}
                >
                    {_("Schedule")}
                </Button>
            </div>
        </div>
    )
}
