import { useEffect, useId, useState } from "react"
import dayjs, { type Dayjs } from "dayjs"
import { BellOffIcon, Clock, MoonIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Label } from "@components/ui/label"
import { Checkbox } from "@components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { useIsMobile } from "@hooks/use-mobile"
import { useScheduleQuietHint } from "@hooks/useQuietHours"
import { useAtomValue } from "jotai"
import { timeFormatAtom } from "@utils/preferences"
import _ from "@lib/translate"
import { getAvailableTimeOptions, toServerDatetime, formatDateTimeLabel, type SchedulePick } from "@lib/timeUtils"
import { cn } from "@lib/utils"
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
    const [sendSilently, setSendSilently] = useState(false)
    const timeFormat = useAtomValue(timeFormatAtom)
    const [date, setDate] = useState<Date>(() => new Date())
    // Next open slot today; "09:00" only when today has none left.
    const [time, setTime] = useState(() => getAvailableTimeOptions(new Date(), timeFormat)[0]?.value ?? "09:00")

    // A date change can strand the selected time in the past — snap forward to
    // the first still-available slot (derived, so the Select stays controlled).
    const availableOptions = getAvailableTimeOptions(date, timeFormat)
    const effectiveTime = availableOptions.some((option) => option.value === time) ? time : availableOptions[0]?.value
    const effectiveOption = availableOptions.find((option) => option.value === effectiveTime)

    // The effective date + time as a Dayjs, or null when incomplete or in the past.
    const [hours, minutes] = effectiveTime ? effectiveTime.split(":").map(Number) : [0, 0]
    const picked = effectiveTime ? dayjs(date).hour(hours).minute(minutes).second(0).millisecond(0) : null
    const pick = picked && picked.isAfter(dayjs()) ? picked : null
    const quietHint = useScheduleQuietHint(pick)
    // The same marks as the preset rows: bell-off when Auto Silent will deliver it silently.
    const QuietIcon = quietHint === "auto" ? BellOffIcon : MoonIcon

    // Live pick for the preview pane — keyed on epoch ms, `pick` is rebuilt every render.
    const pickMs = pick ? pick.valueOf() : null
    useEffect(() => {
        onPickChange?.(pickMs === null ? null : dayjs(pickMs))
    }, [pickMs, onPickChange])

    return (
        <div className="flex w-full flex-col gap-2">
            <Label>{_("Delivery time")}</Label>
            <div className="flex items-center gap-3">
                {/* Grid, not flex — exact equal halves for the two fields. The pair
                    spans half the dialog; mobile keeps full width for touch. */}
                <div className="grid w-full grid-cols-2 items-center gap-3 md:w-1/2 md:shrink-0">
                    <DatePickerPopover value={date} onChange={setDate} size={isMobile ? "lg" : "md"} />
                    <Select value={effectiveTime ?? undefined} onValueChange={setTime} disabled={availableOptions.length === 0}>
                        <SelectTrigger aria-label={_("Time")} inputSize={isMobile ? "lg" : "md"} className="w-full min-w-0">
                            {/* Clock INSIDE SelectValue: the trigger is justify-between, so a
                                third child would strand the time in the middle. */}
                            <SelectValue>
                                {/* On a phone the quiet-hours mark takes the clock's place: a trailing icon gets clipped on narrow screens. */}
                                {isMobile && quietHint ? <QuietIcon className="text-ink-gray-6" aria-hidden /> : <Clock />}
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
                {/* Beside the fields, so it adds no row. Mounted while empty, so screen readers
                    announce it; on a phone the fields fill the row and the time field carries the icon. */}
                <p role="status" className="flex min-w-0 items-center gap-1.5 text-p-sm text-ink-gray-6 max-md:sr-only">
                    {quietHint && <QuietIcon className="size-3.5 shrink-0" aria-hidden />}
                    {quietHint === "auto" && _("Outside working hours, sends silently")}
                    {quietHint === "nudge" && _("Outside working hours")}
                </p>
            </div>
            <SilentCheckbox checked={sendSilently} onCheckedChange={setSendSilently} className="pt-1" />
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
                    onClick={() => pick && onConfirm({ serverTime: toServerDatetime(pick), label: formatDateTimeLabel(pick, timeFormat), sendSilently })}
                >
                    {_("Schedule")}
                </Button>
            </div>
        </div>
    )
}

/** Labelled checkbox for silent delivery, shared by the custom picker and the edit surfaces. */
export const SilentCheckbox = ({ checked, onCheckedChange, className }: { checked: boolean; onCheckedChange: (checked: boolean) => void; className?: string }) => {
    const id = useId()
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
            <Label htmlFor={id} className="cursor-pointer">{_("Send without notification")}</Label>
        </div>
    )
}
