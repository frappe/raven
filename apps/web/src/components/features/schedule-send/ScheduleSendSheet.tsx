import { useState, type ReactNode } from "react"
import { useAtomValue } from "jotai"
import { CalendarClockIcon, ChevronDownIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { timeFormatAtom } from "@utils/preferences"
import { DRAWER_EXIT_MS } from "@utils/drawer"
import { formatTimeLabel, type SchedulePick } from "@lib/timeUtils"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { SLOT_ICONS, pickFromSlot, useScheduleMenuSections } from "./ScheduleSendMenu"

type ScheduleSendSheetProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The send-option rows shown above "Schedule message". */
    sendOptions: ReactNode
    /** A preset slot was picked — schedule immediately. */
    onSchedulePick: (pick: SchedulePick) => void
    /** Open the custom date & time picker. Called after this sheet has closed. */
    onScheduleSend: () => void
    /** Scheduling needs text and no attachments (v1) — hide the row otherwise. */
    scheduleDisabled?: boolean
}

/** One tappable row in the sheet. Same anatomy as the message action sheet's rows. */
export const SheetRow = ({
    onClick, children, trailing, className, expanded,
}: { onClick: () => void; children: ReactNode; trailing?: ReactNode; className?: string; expanded?: boolean }) => (
    <Button
        variant="ghost"
        size="lg"
        theme="gray"
        className={cn("w-full justify-start gap-3 active:bg-surface-gray-2", className)}
        onClick={onClick}
        aria-expanded={expanded}
    >
        {children}
        {trailing && <span className="ms-auto flex items-center tabular-nums text-ink-gray-5">{trailing}</span>}
    </Button>
)

/**
 * Mobile send options as a bottom sheet, opened by a long press on the send button.
 * It lists the send options and a "Schedule message" row. Tapping that row expands
 * the preset slots and the custom entry in place below it, so the sheet grows instead
 * of switching pages. Nested dropdown submenus are hard to drive by touch.
 */
export const ScheduleSendSheet = ({ open, onOpenChange, sendOptions, onSchedulePick, onScheduleSend, scheduleDisabled }: ScheduleSendSheetProps) => (
    <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
            // Keep the composer keyboard steady: no focus moves on open or close.
            keepKeyboard
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
        >
            <DrawerTitle className="sr-only">{_("Send options")}</DrawerTitle>
            <DrawerDescription className="sr-only">{_("Send now, send silently, or schedule the message")}</DrawerDescription>
            {/* The body owns the expanded state. It unmounts with the sheet, so every
                open starts collapsed no matter how the last one was closed. */}
            <SheetBody
                sendOptions={sendOptions}
                onSchedulePick={onSchedulePick}
                onScheduleSend={onScheduleSend}
                scheduleDisabled={scheduleDisabled}
                close={() => onOpenChange(false)}
            />
        </DrawerContent>
    </Drawer>
)

const SheetBody = ({
    sendOptions, onSchedulePick, onScheduleSend, scheduleDisabled, close,
}: Omit<ScheduleSendSheetProps, "open" | "onOpenChange"> & { close: () => void }) => {
    const [expanded, setExpanded] = useState(false)
    const timeFormat = useAtomValue(timeFormatAtom)
    const sections = useScheduleMenuSections()

    return (
        <div className="flex flex-col gap-1 p-3 pb-6">
            {sendOptions}
            {!scheduleDisabled && (
                <SheetRow
                    onClick={() => setExpanded((value) => !value)}
                    expanded={expanded}
                    trailing={<ChevronDownIcon className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")} />}
                >
                    <CalendarClockIcon />
                    {_("Schedule message")}
                </SheetRow>
            )}
            {/* Animated open and close. The outer grid transitions its one row between
                zero and full height, and the inner wrapper clips the content, so no
                measuring is needed. The content stays mounted while collapsed and is
                inert so its rows are not reachable by focus. */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
            >
                <div className="min-h-0 overflow-hidden" inert={expanded ? undefined : true}>
                <div className="flex flex-col gap-1 ps-3">
                    {sections.map((section) => (
                        <div key={section.label} className="flex flex-col gap-1">
                            <span className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                                {section.label}
                            </span>
                            {section.slots.map((slot) => {
                                const Icon = SLOT_ICONS[slot.id]
                                return (
                                    <SheetRow
                                        key={slot.id}
                                        trailing={formatTimeLabel(slot.time.format("HH:mm"), timeFormat)}
                                        onClick={() => {
                                            const pick = pickFromSlot(slot, timeFormat)
                                            close()
                                            if (pick) onSchedulePick(pick)
                                        }}
                                    >
                                        <Icon />
                                        {slot.label}
                                    </SheetRow>
                                )
                            })}
                        </div>
                    ))}
                    <div className="my-1 border-t border-outline-gray-2" />
                    <SheetRow
                        onClick={() => {
                            // The custom picker is its own sheet. Let this one finish
                            // sliding down first, or the two overlays fight.
                            close()
                            window.setTimeout(onScheduleSend, DRAWER_EXIT_MS)
                        }}
                    >
                        <CalendarClockIcon />
                        {_("Custom date & time…")}
                    </SheetRow>
                </div>
                </div>
            </div>
        </div>
    )
}
