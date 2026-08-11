import { useState } from "react"
import dayjs from "dayjs"
import { EditorContent } from "@tiptap/react"
import { CalendarIcon, ChevronDownIcon, Clock } from "lucide-react"
import { EditorFormattingToolbar } from "@components/features/editor/EditorFormattingToolbar"
import { EDITOR_MIN_H } from "@components/features/editor/useRavenEditor"
import { Button } from "@components/ui/button"
import { Calendar } from "@components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { TooltipProvider } from "@components/ui/tooltip"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { formatScheduleLabel } from "./scheduleTime"
import { useScheduledMessageEdit } from "./useScheduledMessageEdit"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"

type InlineScheduledMessageEditorProps = {
    /** The row being edited. */
    row: ScheduledMessageRow
    /** Called after a successful save — the parent refreshes the list and exits edit mode. */
    onDone: () => void
    /** Called when the user cancels (Cancel button / Escape) — the parent exits edit mode. */
    onCancel: () => void
}

type DatePickerPopoverProps = {
    /** The currently picked date — always set (seeded from the row). */
    value: Date
    /** Called with the picked date. */
    onChange: (date: Date) => void
    /** Button size — the mobile sheet passes "lg" for touch targets; the compact
     *  inline editor uses the default "sm". */
    size?: "sm" | "md" | "lg"
}

/**
 * Compact date field for the delivery-time row: a CONTROLLED popover that closes as
 * soon as a date is picked (mirrors DateField in form-elements — an uncontrolled
 * popover would stay open over the time select after picking). Shared by the inline
 * editor and the mobile edit sheet.
 */
export const DatePickerPopover = ({ value, onChange, size = "sm" }: DatePickerPopoverProps) => {
    const [open, setOpen] = useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size={size} className="w-auto justify-start gap-2">
                    <CalendarIcon className="size-4 shrink-0" />
                    <span className="truncate">{dayjs(value).format("ddd, MMM D, YYYY")}</span>
                    <ChevronDownIcon className="size-4 shrink-0 text-ink-gray-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(picked) => {
                        if (picked) {
                            onChange(picked)
                            setOpen(false)
                        }
                    }}
                    disabled={{ before: new Date() }}
                    // 6 fixed week rows — month navigation must not resize the popover.
                    fixedWeeks
                    // 44px date cells on mobile — fingers need more than the 32px default.
                    className="[--cell-size:--spacing(11)] md:[--cell-size:--spacing(8)]"
                />
            </PopoverContent>
        </Popover>
    )
}

/**
 * Inline editor swapped in place of a scheduled-message card's body while it's
 * being edited — the chat-stream pattern (EditMessageComposer): one compact bordered
 * unit holding the TipTap editor, a delivery-time row (date popover + time Select +
 * preview) and small footer buttons. LAYOUT ONLY — all behavior (editor wiring,
 * save/cancel, time options) lives in useScheduledMessageEdit, shared with the
 * mobile edit sheet so the two layouts cannot drift.
 */
export const InlineScheduledMessageEditor = ({ row, onDone, onCancel }: InlineScheduledMessageEditorProps) => {
    const isMobile = useIsMobile()
    const { editor, date, setDate, time, setTime, allTimeOptions, picked, canSave, loading, onSave, linkSignal, onLinkConsumed } =
        useScheduledMessageEdit(row, { onDone, onCancel })

    return (
        <div data-raven-editor className="relative w-full py-1 select-text">
            {/* Same surface styling as EditMessageComposer / the main composer.
                select-text overrides the card row's select-none so the editor can
                take a caret / text selection. */}
            <div className="w-full overflow-y-hidden rounded-lg border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-3">
                <TooltipProvider>
                    {editor && !isMobile && (
                        <EditorFormattingToolbar
                            editor={editor}
                            linkSignal={linkSignal}
                            onLinkConsumed={onLinkConsumed}
                        />
                    )}
                    <div className={EDITOR_MIN_H}>
                        <EditorContent editor={editor} />
                    </div>
                    <div className="flex flex-col gap-2 px-1.5 pb-1.5">
                        {/* Delivery-time row: compact date popover + time Select + preview. */}
                        <div className="flex flex-wrap items-center gap-2">
                            <DatePickerPopover value={date} onChange={setDate} />
                            <Select value={time} onValueChange={setTime}>
                                <SelectTrigger aria-label={_("Time")} inputSize="sm" className="w-28">
                                    <Clock />
                                    <SelectValue>{allTimeOptions.find((option) => option.value === time)?.label}</SelectValue>
                                </SelectTrigger>
                                <SelectContent align="start" className="min-w-28 max-h-62 overflow-y-auto">
                                    {/* px-3 + tabular-nums: fuller rows with evenly spaced
                                        digits (frappe-ui's time-picker look). */}
                                    {allTimeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="px-3 tabular-nums">
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-p-sm text-ink-gray-5">{formatScheduleLabel(picked)}</span>
                        </div>
                        <div className="flex items-center md:justify-start justify-end gap-2">
                            <span className="mr-auto px-1 text-xs text-ink-gray-4 hidden md:block">{_("Esc to cancel")}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                                {_("Cancel")}
                            </Button>
                            <Button type="button" variant="solid" size="sm" onClick={onSave} loading={loading} disabled={!canSave}>
                                {_("Save")}
                            </Button>
                        </div>
                    </div>
                </TooltipProvider>
            </div>
        </div>
    )
}
