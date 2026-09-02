import { useEffect, useState } from "react"
import dayjs, { type Dayjs } from "dayjs"
import { Clock } from "lucide-react"
import { Button } from "@components/ui/button"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { getAvailableTimeOptions, toServerDatetime, formatDateTimeLabel, type SchedulePick } from "@lib/timeUtils"
import { DatePickerPopover } from "@components/features/reminders/DatePickerPopover"

type ScheduleTimePickerProps = {
    /** Fired when the user confirms the custom date + time. */
    onConfirm: (pick: SchedulePick) => void
    /** Renders a Cancel button beside the primary when provided (standard dialog footer). */
    onCancel?: () => void
    /** Live pick updates (null while incomplete/past) — the dialog's preview pane follows these. */
    onPickChange?: (picked: Dayjs | null) => void
    busy?: boolean
}

/**
 * Date + time row for picking a future delivery time, seeded to today + the
 * next open slot. Pure content — the caller owns the overlay and the POST.
 */
export const ScheduleTimePicker = ({ onConfirm, onCancel, onPickChange, busy }: ScheduleTimePickerProps) => {
    const isMobile = useIsMobile()
    const [date, setDate] = useState<Date>(() => new Date())
    // Next open slot today; "09:00" only when today has none left.
    const [time, setTime] = useState(() => getAvailableTimeOptions(new Date())[0]?.value ?? "09:00")

    // A date change can strand the selected time in the past — snap forward to
    // the first still-available slot (derived, so the Select stays controlled).
    const availableOptions = getAvailableTimeOptions(date)
    const effectiveTime = availableOptions.some((option) => option.value === time) ? time : availableOptions[0]?.value
    const effectiveOption = availableOptions.find((option) => option.value === effectiveTime)

    // The effective date + time as a Dayjs, or null when incomplete or in the past.
    const [hours, minutes] = effectiveTime ? effectiveTime.split(":").map(Number) : [0, 0]
    const picked = effectiveTime ? dayjs(date).hour(hours).minute(minutes).second(0).millisecond(0) : null
    const pick = picked && picked.isAfter(dayjs()) ? picked : null

    // Live pick for the preview pane — keyed on epoch ms, `pick` is rebuilt every render.
    const pickMs = pick ? pick.valueOf() : null
    useEffect(() => {
        onPickChange?.(pickMs === null ? null : dayjs(pickMs))
    }, [pickMs, onPickChange])

    return (
        <div className="flex w-full flex-col gap-2">
            <Label>{_("Delivery time")}</Label>
            {/* Grid, not flex — exact equal halves for the two fields. The pair
                spans half the dialog; mobile keeps full width for touch. */}
            <div className="grid grid-cols-2 items-center gap-3 md:w-1/2">
                <DatePickerPopover value={date} onChange={setDate} size={isMobile ? "lg" : "md"} />
                <Select value={effectiveTime ?? undefined} onValueChange={setTime} disabled={availableOptions.length === 0}>
                    <SelectTrigger aria-label={_("Time")} inputSize={isMobile ? "lg" : "md"} className="w-full min-w-0">
                        {/* Clock INSIDE SelectValue: the trigger is justify-between, so a
                            third child would strand the time in the middle. */}
                        <SelectValue>
                            <Clock />
                            {/* Late tonight every slot may already be past — say so instead of crashing. */}
                            {effectiveOption?.label ?? _("No times left today")}
                        </SelectValue>
                    </SelectTrigger>
                    {/* Panel width locked to the trigger's. */}
                    <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0 max-h-62 overflow-y-auto">
                        {availableOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="px-3 py-2 md:py-1.5 tabular-nums">
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {/* Standard footer; mobile buttons share the row edge-to-edge. */}
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
                    onClick={() => pick && onConfirm({ serverTime: toServerDatetime(pick), label: formatDateTimeLabel(pick) })}
                >
                    {_("Schedule")}
                </Button>
            </div>
        </div>
    )
}
