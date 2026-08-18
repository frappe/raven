import { useEffect, useState } from "react"
import dayjs from "dayjs"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { Clock } from "lucide-react"
import { Button } from "@components/ui/button"
import { Label } from "@components/ui/label"
import { Textarea } from "@components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { DialogFooter } from "@components/ui/dialog"
import { ResponsiveDialog, ResponsiveDialogHeader } from "@components/features/message/actions/dialogs/ResponsiveDialog"
import { errorResponseToast } from "@components/ui/error-banner"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { DatePickerPopover } from "./DatePickerPopover"
import { ceilToStep, formatDateTimeLabel, fromServerDatetime, getAvailableTimeOptions, toServerDatetime } from "@lib/timeUtils"
import type { ReminderRow } from "./useReminders"

/** Exact-time + note picker behind the "Remind me" preset submenu; also the
 *  Edit-reminder dialog. Mounted once by MessageActionDialogs. */
export const ReminderDialog = ({
    open,
    message,
    onClose,
    editing,
    onSaved,
}: {
    open: boolean
    message: Message | null
    onClose: () => void
    /** Edit an existing UPCOMING reminder: prefill time + note, submit routes to
     *  update_reminder. Absent = create mode. */
    editing?: ReminderRow
    /** Fired after a successful save in either mode — edit callers refresh their list. */
    onSaved?: () => void
}) => {
    const isMobile = useIsMobile()
    const { call: createReminder, loading: creating } = useFrappePostCall("raven.api.reminders.create_reminder")
    const { call: updateReminder, loading: updating } = useFrappePostCall("raven.api.reminders.update_reminder")
    const loading = creating || updating

    const [note, setNote] = useState("")
    const [date, setDate] = useState<Date>(() => new Date())
    // Next open quarter-hour slot today; "09:00" only when today has none left.
    const [time, setTime] = useState(() => getAvailableTimeOptions(new Date())[0]?.value ?? "09:00")

    // Fresh state per open: create seeds now-ish, edit seeds the row.
    useEffect(() => {
        if (!open) return
        if (editing) {
            // Stored times sit on the 5-min sweep grid, but the Select only offers
            // quarter-hour slots — ceil up to one so the value matches an option.
            const rounded = ceilToStep(fromServerDatetime(editing.remind_at), 15)
            setNote(editing.description ?? "")
            setDate(rounded.toDate())
            setTime(rounded.format("HH:mm"))
        } else {
            setNote("")
            setDate(new Date())
            setTime(getAvailableTimeOptions(new Date())[0]?.value ?? "09:00")
        }
    }, [open, editing])

    // A date change can strand the picked time in the past — snap to the next slot.
    const availableOptions = getAvailableTimeOptions(date)
    const effectiveTime = availableOptions.some((option) => option.value === time) ? time : availableOptions[0]?.value
    const effectiveOption = availableOptions.find((option) => option.value === effectiveTime)

    const [hours, minutes] = effectiveTime ? effectiveTime.split(":").map(Number) : [0, 0]
    const picked = effectiveTime ? dayjs(date).hour(hours).minute(minutes).second(0).millisecond(0) : null
    const customPick = picked && picked.isAfter(dayjs()) ? picked : null

    const submit = (remindAt: dayjs.Dayjs) => {
        if (loading) return
        const payload = {
            remind_at: toServerDatetime(remindAt),
            description: note.trim() || undefined,
        }
        const request = editing
            ? updateReminder({ reminder: editing.name, ...payload })
            : message
                ? createReminder({ message_id: message.name, ...payload })
                : null
        if (!request) return
        request
            .then(() => {
                toast.success(_("Reminder set for {0}", [formatDateTimeLabel(remindAt)]))
                onSaved?.()
                onClose()
            })
            .catch((e) => errorResponseToast(editing ? _("Could not update the reminder") : _("Could not set the reminder"), e))
    }

    return (
        <ResponsiveDialog open={open} onClose={onClose}>
            {/* Description is sr-only — required for a11y, visually redundant. */}
            <ResponsiveDialogHeader
                title={editing ? _("Edit reminder") : _("Reminder")}
                description={_("Pick when to be reminded about this message.")}
                hideDescription
            />

            {/* Date + time — confirmed by the footer button. */}
            <div className="flex flex-col gap-2">
                <Label>{_("When")}</Label>
                <div className="grid grid-cols-2 items-center gap-3">
                    <DatePickerPopover value={date} onChange={setDate} size={isMobile ? "lg" : "md"} />
                    <Select value={effectiveTime ?? undefined} onValueChange={setTime} disabled={availableOptions.length === 0}>
                        <SelectTrigger aria-label={_("Time")} inputSize={isMobile ? "lg" : "md"} className="w-full min-w-0">
                            {/* Clock lives INSIDE SelectValue so the trigger has two children —
                                icon + time cluster left, chevron right (justify-between). */}
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
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-note">{_("Note")}</Label>
                <Textarea
                    id="reminder-note"
                    placeholder={_("Remind me to…")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-16"
                />
            </div>

            {/* Cancel + primary share the row on mobile (house rule). */}
            <DialogFooter className="flex flex-row justify-end gap-2 max-sm:[&>*]:flex-1">
                <Button type="button" variant="outline" size={isMobile ? "lg" : "md"} disabled={loading} onClick={onClose}>
                    {_("Cancel")}
                </Button>
                <Button
                    type="button"
                    variant="solid"
                    size={isMobile ? "lg" : "md"}
                    loading={loading}
                    disabled={!customPick}
                    onClick={() => customPick && submit(customPick)}
                >
                    {editing ? _("Save") : _("Set reminder")}
                </Button>
            </DialogFooter>
        </ResponsiveDialog>
    )
}
