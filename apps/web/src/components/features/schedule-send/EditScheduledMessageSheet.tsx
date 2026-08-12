import { EditorContent } from "@tiptap/react"
import { Clock } from "lucide-react"
import { EditorFormattingToolbar } from "@components/features/editor/EditorFormattingToolbar"
import { Button } from "@components/ui/button"
import { Drawer, DrawerContent, DrawerFooter, DrawerTitle } from "@components/ui/drawer"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { TooltipProvider } from "@components/ui/tooltip"
import _ from "@lib/translate"
import { formatScheduleLabel } from "./scheduleTime"
import { useScheduledMessageEdit } from "./useScheduledMessageEdit"
import { DatePickerPopover } from "./InlineScheduledMessageEditor"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"

type EditScheduledMessageSheetProps = {
    /** The row being edited. */
    row: ScheduledMessageRow
    /** Open state — the list mounts this only while editing, so always true in practice. */
    open: boolean
    /** Dismiss (drag down / overlay tap / Cancel button) — cancels the edit. */
    onOpenChange: (open: boolean) => void
    /** Called after a successful save — the parent refreshes the list and exits edit mode. */
    onDone: () => void
}

/**
 * Mobile bottom-sheet edit layout for a scheduled message. Layout only —
 * behavior lives in useScheduledMessageEdit, shared with the desktop inline
 * editor. Dismissing the sheet cancels the edit.
 */
export const EditScheduledMessageSheet = ({ row, open, onOpenChange, onDone }: EditScheduledMessageSheetProps) => {
    const { editor, date, setDate, time, setTime, allTimeOptions, picked, canSave, loading, onSave, linkSignal, onLinkConsumed } =
        useScheduledMessageEdit(row, { onDone, onCancel: () => onOpenChange(false) })

    // repositionInputs={false}: vaul's keyboard handling would shrink the sheet
    // and squish the editor — off, the keyboard just overlays the lower part.
    return (
        <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
            {/* If content outgrows the cap, the flex chain squeezes only the text
                area (everything else is shrink-proof) — the sheet never scrolls. */}
            <DrawerContent className="max-h-[calc(100dvh-2rem)]">
                {/* Title inside the px-4 body so it aligns with the fields (same as
                    the Create Channel sheet). */}
                <div className="flex min-h-0 flex-col gap-5 px-4 pt-1 pb-2">
                    <DrawerTitle className="shrink-0 text-left text-2xl-semibold text-ink-gray-9">
                        {_("Edit scheduled message")}
                    </DrawerTitle>
                    {/* Composer-style box: toolbar pinned on top, overflow-hidden clips
                        its square band to the rounded corners. */}
                    <div className="flex min-h-0 flex-col gap-2">
                        <Label className="shrink-0">{_("Message")}</Label>
                        <div
                            data-raven-editor
                            className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-3"
                        >
                            <TooltipProvider>
                                {editor && (
                                    <div className="shrink-0">
                                        <EditorFormattingToolbar
                                            editor={editor}
                                            linkSignal={linkSignal}
                                            onLinkConsumed={onLinkConsumed}
                                        />
                                    </div>
                                )}
                            </TooltipProvider>
                            {/* The one scroller. max-h-none neutralizes .tiptap's own
                                max-h-[40vh] scroll (nested scrollers fight on touch);
                                min-h-24 keeps a ~4-line floor when squeezed. */}
                            <div className="min-h-24 overflow-y-auto [&_.tiptap]:max-h-none [&_.tiptap]:min-h-24">
                                <EditorContent editor={editor} />
                            </div>
                        </div>
                    </div>
                    {/* Delivery time: date + time side by side on one row, preview underneath. */}
                    <div className="flex shrink-0 flex-col gap-2">
                        <Label>{_("Delivery time")}</Label>
                        {/* Grid, not flex — exact equal halves for the two fields. */}
                        <div className="grid grid-cols-2 items-center gap-3">
                            <DatePickerPopover value={date} onChange={setDate} size="lg" />
                            <Select value={time} onValueChange={setTime}>
                                <SelectTrigger aria-label={_("Time")} inputSize="lg" className="w-full min-w-0">
                                    <Clock />
                                    <SelectValue>{allTimeOptions.find((option) => option.value === time)?.label}</SelectValue>
                                </SelectTrigger>
                                {/* align="end": the panel can be wider than the trigger,
                                    which sits at the sheet's right edge. */}
                                <SelectContent align="end" className="max-h-62 overflow-y-auto">
                                    {/* tabular-nums + px-3: frappe-ui's time-picker row look. */}
                                    {allTimeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="px-3 py-2 tabular-nums">
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-p-sm text-ink-gray-5">{formatScheduleLabel(picked)}</p>
                    </div>
                </div>
                <DrawerFooter className="flex-row gap-2 [&>*]:flex-1">
                    <Button type="button" variant="outline" size="lg" disabled={loading} onClick={() => onOpenChange(false)}>
                        {_("Cancel")}
                    </Button>
                    <Button type="button" variant="solid" size="lg" loading={loading} disabled={!canSave} onClick={onSave}>
                        {_("Save")}
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}
