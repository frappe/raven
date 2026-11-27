import { useState } from "react"
import { CheckIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@components/ui/drawer"
import { getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { StatusUntil } from "@components/common/StatusUntil"
import { AvailabilityEndTimeDialog } from "@components/features/profile/StatusEndTimeDialog"
import { availabilityLabel, availabilityOptions, useSetAvailability, type AvailabilityStatus } from "@hooks/useSetAvailability"
import { durationEndsAt, getAvailabilityDurations } from "@lib/statusExpiry"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

const ROW = "flex w-full items-center gap-3 rounded-md px-2 py-3 text-left active:bg-surface-gray-2"

/**
 * Quick availability picker — opened by LONG-PRESSING the footer's Profile tab
 * (the tap still navigates to the profile page, where the full editor lives).
 * Available sets and closes; Away, Do not disturb and Invisible step to their durations.
 */
export const StatusDrawer = ({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const { availability, endsAt, setAvailability } = useSetAvailability()
    const [durationsFor, setDurationsFor] = useState<AvailabilityStatus | null>(null)
    const [choosingEndFor, setChoosingEndFor] = useState<AvailabilityStatus | null>(null)
    const [endPickerQueued, setEndPickerQueued] = useState(false)

    // Fire-and-close: the request settles in the background and reports through the hook's toast.
    const set = (status: AvailabilityStatus, statusEndsAt: string | null = null) => {
        setAvailability(status, statusEndsAt)
        onOpenChange(false)
    }

    return (
        <>
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                onAnimationEnd={(isOpen) => {
                    if (isOpen) return
                    // The end-time sheet waits for this one to finish closing, so two never slide at once.
                    if (endPickerQueued) setChoosingEndFor(durationsFor)
                    setEndPickerQueued(false)
                    // Reopening starts from the status list, not a durations step left open.
                    setDurationsFor(null)
                }}
            >
                <DrawerContent>
                    <DrawerHeader className="flex flex-row items-center gap-1 px-4 pb-2 pt-0 text-left">
                        {durationsFor && (
                            <Button variant="ghost" size="lg" isIconButton aria-label={_("Back")} className="-ms-2" onClick={() => setDurationsFor(null)}>
                                <ChevronLeft className="size-6" />
                            </Button>
                        )}
                        <DrawerTitle>{durationsFor ? availabilityLabel(durationsFor) : _("Set availability")}</DrawerTitle>
                        <DrawerDescription className="sr-only">
                            {durationsFor ? _("Choose how long it lasts") : _("Choose how you appear to others")}
                        </DrawerDescription>
                    </DrawerHeader>
                    <ul className="flex flex-col px-2 pb-6">
                        {durationsFor
                            ? getAvailabilityDurations().map((duration) => (
                                <li key={duration.id}>
                                    <button
                                        type="button"
                                        className={ROW}
                                        onClick={() => {
                                            if (duration.id === "custom") {
                                                setEndPickerQueued(true)
                                                onOpenChange(false)
                                            } else {
                                                set(durationsFor, durationEndsAt(duration.id))
                                            }
                                        }}
                                    >
                                        <span className="flex-1 text-base text-ink-gray-8">{duration.label}</span>
                                    </button>
                                </li>
                            ))
                            : availabilityOptions().map((option) => {
                                const isCurrent = availability === option.value
                                return (
                                    <li key={option.value}>
                                        <button
                                            type="button"
                                            className={ROW}
                                            onClick={() => (option.value === "Available" ? set(option.value) : setDurationsFor(option.value))}
                                        >
                                            <span className={cn("size-3 shrink-0 rounded-full", getStatusIndicatorColor(option.value))} />
                                            <span className="flex flex-1 flex-col">
                                                <span className="text-base text-ink-gray-8">{option.label}</span>
                                                {isCurrent && <StatusUntil endsAt={endsAt} className="text-sm text-ink-gray-5" />}
                                            </span>
                                            {isCurrent && <CheckIcon className="size-4.5 shrink-0 text-ink-gray-7" />}
                                            {option.value !== "Available" && <ChevronRight className="size-4.5 shrink-0 text-ink-gray-5" />}
                                        </button>
                                    </li>
                                )
                            })}
                    </ul>
                </DrawerContent>
            </Drawer>
            <AvailabilityEndTimeDialog availability={choosingEndFor} onClose={() => setChoosingEndFor(null)} />
        </>
    )
}
