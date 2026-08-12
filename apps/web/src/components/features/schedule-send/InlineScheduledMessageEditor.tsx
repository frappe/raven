import { useState } from "react"
import { EditorContent } from "@tiptap/react"
import { CalendarIcon, Clock } from "lucide-react"
import { EditorFormattingToolbar } from "@components/features/editor/EditorFormattingToolbar"
import { EDITOR_MIN_H } from "@components/features/editor/useRavenEditor"
import { Button } from "@components/ui/button"
import { Calendar } from "@components/ui/calendar"
import { Input } from "@components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { TooltipProvider } from "@components/ui/tooltip"
import { useIsMobile } from "@hooks/use-mobile"
import { formatDate, parseTypedDate, USER_DATE_FORMAT } from "@lib/date"
import { cn } from "@lib/utils"
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
    /** Input size — the mobile surfaces pass "lg" for touch targets; the compact
     *  inline editor uses the default "sm". */
    size?: "sm" | "md" | "lg"
    /** Root wrapper — the row decides the field's width. */
    className?: string
}

/**
 * Typeable date field + calendar popover — DateField's mechanics without the
 * react-hook-form binding. Shared by all three schedule-send surfaces.
 */
export const DatePickerPopover = ({ value, onChange, size = "sm", className }: DatePickerPopoverProps) => {
    const [open, setOpen] = useState(false)
    // Display state only — blur resnaps to `value`, discarding unparseable leftovers.
    const [text, setText] = useState(() => formatDate(value))

    const commitTyped = (raw: string) => {
        setText(raw)
        const parsed = parseTypedDate(raw)
        if (parsed) onChange(parsed)
    }

    return (
        <div className={cn("relative min-w-0", className)}>
            {/* min-w-0: a text input's intrinsic min-width would beat flex-1's
                equal share and steal width from the time select. */}
            <Input
                inputSize={size}
                className="w-full min-w-0 pe-9"
                placeholder={USER_DATE_FORMAT}
                aria-label={_("Date")}
                value={text}
                onChange={(e) => commitTyped(e.target.value)}
                onBlur={() => setText(formatDate(value))}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setOpen(true)
                    }
                }}
            />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        isIconButton
                        aria-label={_("Select date")}
                        className="absolute top-1/2 -translate-y-1/2 ltr:right-1.5 rtl:left-1.5"
                    >
                        <CalendarIcon />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={(picked) => {
                            if (picked) {
                                onChange(picked)
                                setText(formatDate(picked))
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
        </div>
    )
}

/**
 * Inline editor swapped in for a card's body while editing (chat-stream
 * pattern, EditMessageComposer). Layout only — behavior lives in
 * useScheduledMessageEdit, shared with the mobile edit sheet.
 */
export const InlineScheduledMessageEditor = ({ row, onDone, onCancel }: InlineScheduledMessageEditorProps) => {
    const isMobile = useIsMobile()
    const { editor, date, setDate, time, setTime, allTimeOptions, picked, canSave, loading, onSave, linkSignal, onLinkConsumed } =
        useScheduledMessageEdit(row, { onDone, onCancel })

    return (
        <div data-raven-editor className="relative w-full py-1 select-text">
            {/* select-text overrides the card row's select-none so the editor can take a caret. */}
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
                            <DatePickerPopover value={date} onChange={setDate} className="w-40" />
                            <Select value={time} onValueChange={setTime}>
                                <SelectTrigger aria-label={_("Time")} inputSize="sm" className="w-28">
                                    <Clock />
                                    <SelectValue>{allTimeOptions.find((option) => option.value === time)?.label}</SelectValue>
                                </SelectTrigger>
                                <SelectContent align="start" className="min-w-28 max-h-62 overflow-y-auto">
                                    {/* tabular-nums + px-3: frappe-ui's time-picker row look. */}
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
