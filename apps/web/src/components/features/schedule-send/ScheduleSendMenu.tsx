import { Fragment, useRef, useState } from "react"
import dayjs from "dayjs"
import {
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@components/ui/dropdown-menu"
import { CalendarClockIcon } from "lucide-react"
import _ from "@lib/translate"
import { getScheduleMenuSections, toServerDatetime, formatScheduleLabel } from "./scheduleTime"
import type { SchedulePick } from "./scheduleTime"

type ScheduleSendMenuProps = {
    /** A preset slot was picked from the submenu — schedule immediately. */
    onSchedulePick: (pick: SchedulePick) => void
    /** Open the custom date & time dialog. */
    onScheduleSend: () => void
    /** Scheduling needs text and no attachments (v1) — disable the submenu otherwise. */
    scheduleDisabled?: boolean
}

/**
 * The "Schedule message" submenu inside SendButton's send-options menu: Today /
 * Tomorrow preset slots plus a custom date & time entry. It renders inside
 * DropdownMenuContent, so it only mounts while the options menu is open; the slot
 * sections are computed inside DropdownMenuSubContent (mounted only when the
 * submenu opens), so the work never runs on plain ChatInput keystrokes.
 */
export const ScheduleSendMenu = ({ onSchedulePick, onScheduleSend, scheduleDisabled }: ScheduleSendMenuProps) => {
    // Bottom-align the schedule submenu to its trigger row: Radix hardcodes
    // align="start" on sub content (top edges aligned), so we measure the height
    // difference at open and shift up by it via alignOffset (the only sub-content
    // alignment prop Radix forwards). This state lives inside DropdownMenuContent,
    // so closing the options menu unmounts it — a stale measurement can't survive
    // into the next open.
    const subTriggerRef = useRef<HTMLDivElement>(null)
    const [subAlignOffset, setSubAlignOffset] = useState(0)

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger ref={subTriggerRef} disabled={scheduleDisabled} className="text-base md:text-sm py-2.5 md:py-1.5">
                <CalendarClockIcon />
                {_("Schedule message")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
                alignOffset={subAlignOffset}
                ref={(node) => {
                    if (!node || !subTriggerRef.current) return
                    // Bottom-align to the trigger row: shift up by the height difference
                    // (content height varies — Today hides in the evening, Monday appears
                    // on weekends). The same-value guard stops the re-render loop: the
                    // callback re-runs after the offset-driven render and measures again.
                    const offset = -(node.offsetHeight - subTriggerRef.current.offsetHeight)
                    setSubAlignOffset((prev) => (prev === offset ? prev : offset))
                }}
            >
                <ScheduleMenuSections onSchedulePick={onSchedulePick} />
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onScheduleSend} className="text-base md:text-sm py-2.5 md:py-1.5">
                    {_("Custom date & time…")}
                </DropdownMenuItem>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    )
}

/**
 * The preset Today / Tomorrow / (weekend) Monday sections of the schedule submenu.
 * Rendered inside DropdownMenuSubContent so getScheduleMenuSections() runs only
 * while the submenu is open — slot times stay fresh without per-render cost.
 */
const ScheduleMenuSections = ({ onSchedulePick }: { onSchedulePick: (pick: SchedulePick) => void }) => {
    const sections = getScheduleMenuSections()
    return (
        <>
            {sections.map((section, i) => (
                <Fragment key={section.label}>
                    {i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-ink-gray-5 text-base md:text-sm">{section.label}</DropdownMenuLabel>
                    {section.slots.map((slot) => (
                        <DropdownMenuItem
                            key={`${section.label}-${slot.label}`}
                            className="text-base md:text-sm py-2.5 md:py-1.5 justify-between gap-4"
                            onSelect={() => {
                                // The menu may have sat open across the slot's boundary — re-check at click
                                // time so we don't POST a time the server will reject as past.
                                if (!slot.time.isAfter(dayjs())) return
                                onSchedulePick({ serverTime: toServerDatetime(slot.time), label: formatScheduleLabel(slot.time) })
                            }}
                        >
                            <span>{slot.label}</span>
                            <span className="text-ink-gray-5">{slot.time.format("h:mm A")}</span>
                        </DropdownMenuItem>
                    ))}
                </Fragment>
            ))}
        </>
    )
}
