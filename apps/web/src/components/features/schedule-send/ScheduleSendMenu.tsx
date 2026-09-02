import { useRef, useState } from "react"
import dayjs from "dayjs"
import { useFrappeGetCall } from "frappe-react-sdk"
import {
    DropdownMenuItem, DropdownMenuSeparator,
    DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@components/ui/dropdown-menu"
import { CalendarClockIcon } from "lucide-react"
import _ from "@lib/translate"
import { getScheduleMenuSections, toServerDatetime, formatDateTimeLabel } from "@lib/timeUtils"
import type { SchedulePick } from "@lib/timeUtils"

type ScheduleSendMenuProps = {
    /** A preset slot was picked from the submenu — schedule immediately. */
    onSchedulePick: (pick: SchedulePick) => void
    /** Open the custom date & time dialog. */
    onScheduleSend: () => void
    /** Scheduling needs text and no attachments (v1) — disable the submenu otherwise. */
    scheduleDisabled?: boolean
}

/**
 * "Schedule message" submenu in the send-options menu: Today / Tomorrow /
 * next-working-day submenus of preset slots, plus a custom date & time entry.
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
                    // (content height varies — Today hides in the evening, the next working
                    // day appears when it isn't tomorrow). The same-value guard stops the
                    // re-render loop: the callback re-runs after the offset-driven render.
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
 * Preset day submenus, computed inside DropdownMenuSubContent so slot times are
 * fresh on open without per-keystroke cost.
 */
const ScheduleMenuSections = ({ onSchedulePick }: { onSchedulePick: (pick: SchedulePick) => void }) => {
    // Server-computed (Holiday List aware); until it lands only Today / Tomorrow show.
    const { data } = useFrappeGetCall<{ message: string }>(
        "raven.api.scheduled_message.get_next_working_day",
        undefined,
        "next-working-day",
    )
    const sections = getScheduleMenuSections(dayjs(), data?.message ? dayjs(data.message) : null)
    return (
        <>
            {sections.map((section) => (
                <DropdownMenuSub key={section.label}>
                    <DropdownMenuSubTrigger className="text-base md:text-sm py-2.5 md:py-1.5">
                        {section.label}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {section.slots.map((slot) => (
                            <DropdownMenuItem
                                key={slot.label}
                                className="text-base md:text-sm py-2.5 md:py-1.5 justify-between gap-4"
                                onSelect={() => {
                                    // The menu may have sat open across the slot's boundary — re-check at click
                                    // time so we don't POST a time the server will reject as past.
                                    if (!slot.time.isAfter(dayjs())) return
                                    onSchedulePick({ serverTime: toServerDatetime(slot.time), label: formatDateTimeLabel(slot.time) })
                                }}
                            >
                                <span>{slot.label}</span>
                                <span className="text-ink-gray-5">{slot.time.format("h:mm A")}</span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            ))}
        </>
    )
}
