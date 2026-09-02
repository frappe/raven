import { EditorContent } from "@tiptap/react"
import { Clock } from "lucide-react"
import { EditorFormattingToolbar } from "@components/features/editor/EditorFormattingToolbar"
import { EDITOR_MIN_H } from "@components/features/editor/useRavenEditor"
import { Button } from "@components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { TooltipProvider } from "@components/ui/tooltip"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { DatePickerPopover } from "@components/features/reminders/DatePickerPopover"
import { formatDateTimeLabel } from "@lib/timeUtils"
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

/**
 * Inline editor swapped in for a card's body while editing (chat-stream
 * pattern, EditMessageComposer). Layout only — behavior lives in
 * useScheduledMessageEdit, shared with the mobile edit sheet.
 */
export const InlineScheduledMessageEditor = ({ row, onDone, onCancel }: InlineScheduledMessageEditorProps) => {
    const isMobile = useIsMobile()
    const { editor, date, setDate, time, setTime, allTimeOptions, picked, pastPick, canSave, loading, onSave, linkSignal, onLinkConsumed } =
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
                                    {/* Clock INSIDE SelectValue: the trigger is justify-between, so a
                                        third child would strand the time in the middle. */}
                                    <SelectValue>
                                        <Clock />
                                        {allTimeOptions.find((option) => option.value === time)?.label}
                                    </SelectValue>
                                </SelectTrigger>
                                {/* Panel width locked to the trigger's. */}
                                <SelectContent align="start" className="w-[var(--radix-select-trigger-width)] min-w-0 max-h-62 overflow-y-auto">
                                    {/* tabular-nums + px-3: frappe-ui's time-picker row look. */}
                                    {allTimeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="px-3 tabular-nums">
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {/* Clock race: the picked time can pass while the editor sits
                                open — say why Save is off instead of silently disabling it. */}
                            <span className={pastPick ? "text-p-sm text-ink-red-5" : "text-p-sm text-ink-gray-5"}>
                                {pastPick ? _("Delivery time is in the past") : formatDateTimeLabel(picked)}
                            </span>
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
