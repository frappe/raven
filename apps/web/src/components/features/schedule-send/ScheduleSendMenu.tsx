import { useRef, useState } from "react"
import dayjs, { type Dayjs } from "dayjs"
import { useFrappeGetCall } from "frappe-react-sdk"
import { useAtomValue } from "jotai"
import {
    DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSwitchItem,
} from "@components/ui/dropdown-menu"
import { BellOffIcon, CalendarClockIcon, MoonIcon, SunIcon, SunriseIcon, SunsetIcon, type LucideIcon } from "lucide-react"
import { timeFormatAtom } from "@utils/preferences"
import { useScheduleQuietHint } from "@hooks/useQuietHours"
import _ from "@lib/translate"
import { getScheduleMenuSections, toServerDatetime, formatDateTimeLabel, formatTimeLabel } from "@lib/timeUtils"
import type { SchedulePick, ScheduleMenuSlot, ScheduleSlotId } from "@lib/timeUtils"

/** One icon per preset slot, shared by the desktop submenu and the mobile sheet. */
export const SLOT_ICONS: Record<ScheduleSlotId, LucideIcon> = {
    morning: SunriseIcon,
    afternoon: SunIcon,
    evening: SunsetIcon,
}

/**
 * The preset day sections for the schedule pickers. The next working day comes from
 * the server (Holiday List aware); until it lands only Today and Tomorrow show.
 * Computed on each call so the slot times are fresh whenever a menu opens.
 */
export const useScheduleMenuSections = () => {
    const { data } = useFrappeGetCall<{ message: string }>(
        "raven.api.scheduled_message.get_next_working_day",
        undefined,
        "next-working-day",
    )
    return getScheduleMenuSections(dayjs(), data?.message ? dayjs(data.message) : null)
}

/** Turn a picked slot into the payload the composer posts. Null if the slot has passed. */
export const pickFromSlot = (
    slot: ScheduleMenuSlot,
    timeFormat: "12-hour" | "24-hour",
    sendSilently: boolean,
): SchedulePick | null => {
    // The menu may have sat open across the slot's boundary. Re-check at click time
    // so we never post a time the server will reject as past.
    if (!slot.time.isAfter(dayjs())) return null
    return { serverTime: toServerDatetime(slot.time), label: formatDateTimeLabel(slot.time, timeFormat), sendSilently }
}

/** Marks a preset that lands outside working hours: a moon, or a bell-off when the
 *  user's Auto Silent preference will deliver it silently. */
export const QuietSlotMark = ({ time, sendSilently }: { time: Dayjs; sendSilently: boolean }) => {
    const hint = useScheduleQuietHint(time, sendSilently)
    if (!hint) return null
    const Icon = hint === "auto" ? BellOffIcon : MoonIcon
    return (
        <>
            <Icon className="size-3.5 text-ink-gray-5" aria-hidden />
            <span className="sr-only">
                {hint === "auto" ? _("Outside working hours, sends without notification") : _("Outside working hours")}
            </span>
        </>
    )
}

type ScheduleSendMenuProps = {
    /** A preset slot was picked from the submenu — schedule immediately. */
    onSchedulePick: (pick: SchedulePick) => void
    /** Open the custom date & time dialog, carrying the silent choice made here. */
    onScheduleSend: (sendSilently: boolean) => void
    /** Nothing to schedule, or uploads still running — disable the submenu. */
    scheduleDisabled?: boolean
}

/**
 * Desktop "Schedule message" submenu in the send-options menu: the preset slots
 * grouped by day (Today / Tomorrow / next working day), plus a custom date & time
 * entry. Mobile uses ScheduleSendSheet instead.
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
    // Lives inside DropdownMenuContent too, so every open starts with the switch off.
    const [sendSilently, setSendSilently] = useState(false)

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger ref={subTriggerRef} disabled={scheduleDisabled}>
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
                <ScheduleMenuSections onSchedulePick={onSchedulePick} sendSilently={sendSilently} />
                <DropdownMenuSeparator />
                <DropdownMenuSwitchItem checked={sendSilently} onCheckedChange={setSendSilently}>
                    <span className="flex items-center gap-2">
                        <BellOffIcon />
                        {_("Send without notification")}
                    </span>
                </DropdownMenuSwitchItem>
                <DropdownMenuItem onSelect={() => onScheduleSend(sendSilently)}>
                    {_("Custom date & time…")}
                </DropdownMenuItem>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    )
}

/**
 * Preset slots as labelled groups, one per day, inside the schedule submenu. Groups
 * rather than nested submenus: there are at most three days with three slots each,
 * so one flat list reads faster than another level of menus. Computed inside
 * DropdownMenuSubContent so slot times are fresh on open without per-keystroke cost.
 */
const ScheduleMenuSections = ({ onSchedulePick, sendSilently }: { onSchedulePick: (pick: SchedulePick) => void; sendSilently: boolean }) => {
    const timeFormat = useAtomValue(timeFormatAtom)
    const sections = useScheduleMenuSections()
    return (
        <>
            {sections.map((section, index) => (
                <DropdownMenuGroup key={section.label}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                    {section.slots.map((slot) => {
                        const Icon = SLOT_ICONS[slot.id]
                        return (
                            <DropdownMenuItem
                                key={slot.id}
                                className="justify-between gap-4"
                                onSelect={() => {
                                    const pick = pickFromSlot(slot, timeFormat, sendSilently)
                                    if (pick) onSchedulePick(pick)
                                }}
                            >
                                <span className="flex items-center gap-2">
                                    <Icon />
                                    {slot.label}
                                </span>
                                <span className="flex items-center gap-1.5 tabular-nums text-ink-gray-5">
                                    <QuietSlotMark time={slot.time} sendSilently={sendSilently} />
                                    {formatTimeLabel(slot.time.format("HH:mm"), timeFormat)}
                                </span>
                            </DropdownMenuItem>
                        )
                    })}
                </DropdownMenuGroup>
            ))}
        </>
    )
}
