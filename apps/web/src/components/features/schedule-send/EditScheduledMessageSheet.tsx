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
 * Mobile-only bottom-sheet edit layout for a scheduled message: a dedicated sheet
 * with breathing room — labelled sections, a composer-style input (toolbar pinned
 * inside the box, text area growing to a cap then scrolling INTERNALLY so the
 * sheet itself never scrolls), a one-row delivery-time section and a side-by-side
 * footer. All behavior comes from useScheduledMessageEdit (shared with the desktop
 * inline editor) so the two layouts cannot drift. The sheet's dismiss maps to
 * cancelling the edit; Escape is consumed by the editor itself.
 */
export const EditScheduledMessageSheet = ({ row, open, onOpenChange, onDone }: EditScheduledMessageSheetProps) => {
    const { editor, date, setDate, time, setTime, allTimeOptions, picked, canSave, loading, onSave, linkSignal, onLinkConsumed } =
        useScheduledMessageEdit(row, { onDone, onCancel: () => onOpenChange(false) })

    // repositionInputs={false}: vaul's default keyboard handling shrinks the
    // sheet to the visual viewport, squishing the editor to its floor. Off,
    // the sheet stays put and the keyboard simply overlays its lower part
    // (delivery time + footer) — the keyboard's top edge sits right below
    // the focused input, which is the behavior we want while typing.
    return (
        <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
            {/* max-h caps the whole sheet; every section except the editor's text area
                is shrink-proof, so if content ever outgrows the screen the flex chain
                squeezes ONLY the text area, which then scrolls internally — the sheet
                itself never scrolls and never outgrows the screen. */}
            <DrawerContent className="max-h-[calc(100dvh-2rem)]">
                {/* Title lives inside the px-4 body (not DrawerHeader's px-6) so it
                    left-aligns with the fields — same header treatment as the
                    Create Channel sheet. */}
                <div className="flex min-h-0 flex-col gap-5 px-4 pt-1 pb-2">
                    <DrawerTitle className="shrink-0 text-left text-2xl-semibold text-ink-gray-9">
                        {_("Edit scheduled message")}
                    </DrawerTitle>
                    {/* Message: a composer-style input — toolbar pinned at the top INSIDE
                        the bordered box, text area below it. overflow-hidden clips the
                        toolbar's opaque band to the box's rounded corners. min-h-0 on the
                        section and box lets the squeeze reach the text area, which is the
                        one part that gives way (down to its own min-h-24 floor).
                        data-raven-editor scopes the editor-only rich-text styles
                        (placeholder, spoiler, …). */}
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
                            {/* The ONE scroll container for the text. .tiptap ships its own
                                max-h-[40vh] + overflow-y-auto (useRavenEditor) — max-h-none
                                neutralizes that so this wrapper is the only scroller (nested
                                scroll areas fight on touch). No max-h here either: the
                                wrapper grows with content until the SHEET hits its cap, then
                                the flex chain squeezes it — min-h-24 (not min-h-0) is the
                                floor, so the text area always keeps ~4 lines and scrolls
                                instead of being clipped away. Padding lives on .tiptap
                                itself. */}
                            <div className="min-h-24 overflow-y-auto [&_.tiptap]:max-h-none [&_.tiptap]:min-h-24">
                                <EditorContent editor={editor} />
                            </div>
                        </div>
                    </div>
                    {/* Delivery time: date + time side by side on one row, preview underneath. */}
                    <div className="flex shrink-0 flex-col gap-2">
                        <Label>{_("Delivery time")}</Label>
                        <div className="flex items-center gap-3">
                            <DatePickerPopover value={date} onChange={setDate} size="lg" />
                            <Select value={time} onValueChange={setTime}>
                                <SelectTrigger aria-label={_("Time")} inputSize="lg" className="flex-1">
                                    <Clock />
                                    <SelectValue>{allTimeOptions.find((option) => option.value === time)?.label}</SelectValue>
                                </SelectTrigger>
                                {/* align="end": the panel's min width can exceed the trigger's,
                                    and the trigger sits at the sheet's right edge — right-align
                                    so the panel never pokes past it (or off-screen). */}
                                <SelectContent align="end">
                                    {/* px-3/py-2 + tabular-nums: fuller rows with evenly
                                        spaced digits (frappe-ui's time-picker look). */}
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
