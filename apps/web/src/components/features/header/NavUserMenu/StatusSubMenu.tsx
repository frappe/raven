import { CheckIcon, CircleDot } from "lucide-react"
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@components/ui/dropdown-menu"
import { getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { useStatusUntilLabel } from "@components/common/StatusUntil"
import { availabilityOptions, useSetAvailability, type AvailabilityStatus } from "@hooks/useSetAvailability"
import { durationEndsAt, getAvailabilityDurations } from "@lib/statusExpiry"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * Quick availability switcher, one hover away from the avatar. Available sets at once;
 * Away, Do not disturb and Invisible each open their durations. "Choose date and time…"
 * is handed up, since its dialog must outlive this menu.
 */
export const StatusSubMenu = ({ onChooseEnd }: { onChooseEnd: (availability: AvailabilityStatus) => void }) => {
    const { availability, endsAt, setAvailability } = useSetAvailability()
    const until = useStatusUntilLabel(endsAt)

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <CircleDot />
                <span>{_("Status")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48">
                {availabilityOptions().map((option) => {
                    const label = (
                        <>
                            <span className={cn("size-2 shrink-0 rounded-full", getStatusIndicatorColor(option.value))} />
                            <span className="flex-1">{option.label}</span>
                            {availability === option.value && <CheckIcon className="size-4 shrink-0" aria-label={_("Current")} />}
                        </>
                    )

                    if (option.value === "Available") {
                        return (
                            <DropdownMenuItem key={option.value} onSelect={() => setAvailability(option.value)}>
                                {label}
                                {/* Holds the chevron's lane, so every row's check lines up. */}
                                <span className="size-4 shrink-0" aria-hidden="true" />
                            </DropdownMenuItem>
                        )
                    }

                    return (
                        <DropdownMenuSub key={option.value}>
                            <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {getAvailabilityDurations().map((duration) => (
                                    <DropdownMenuItem
                                        key={duration.id}
                                        onSelect={() =>
                                            duration.id === "custom"
                                                ? onChooseEnd(option.value)
                                                : setAvailability(option.value, durationEndsAt(duration.id))
                                        }
                                    >
                                        {duration.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )
                })}
                {until && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>{until}</DropdownMenuLabel>
                    </>
                )}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    )
}
