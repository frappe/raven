import { CheckIcon } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@components/ui/drawer"
import { getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { AVAILABILITY_OPTIONS, useSetAvailability } from "@hooks/useSetAvailability"
import { useHistoryBackClose } from "@hooks/useHistoryBackClose"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * Quick availability picker — opened by LONG-PRESSING the footer's Profile tab
 * (the tap still navigates to the profile page, where the full editor lives).
 * One row per status; tapping sets it and closes.
 */
export const StatusDrawer = ({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const { availability, setAvailability } = useSetAvailability()

    // The open drawer owns the system back gesture — it's hosted in the footer,
    // which is mounted across pages, so back would otherwise navigate the page
    // underneath the still-open drawer.
    useHistoryBackClose(open, () => onOpenChange(false))

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader className="px-4 pb-2 pt-0 text-left">
                    <DrawerTitle>{_("Set availability")}</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        {_("Choose how you appear to others")}
                    </DrawerDescription>
                </DrawerHeader>
                <ul className="flex flex-col px-2 pb-6">
                    {AVAILABILITY_OPTIONS.map((option) => (
                        <li key={option.value}>
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left active:bg-surface-gray-2"
                                onClick={() => {
                                    // Fire-and-close: the request settles in the background
                                    // and reports through the hook's toast either way.
                                    setAvailability(option.value)
                                    onOpenChange(false)
                                }}
                            >
                                <span className={cn("size-3 shrink-0 rounded-full", getStatusIndicatorColor(option.value))} />
                                <span className="flex-1 text-base text-ink-gray-8">{option.label}</span>
                                {availability === option.value && <CheckIcon className="size-4.5 shrink-0 text-ink-gray-7" />}
                            </button>
                        </li>
                    ))}
                </ul>
            </DrawerContent>
        </Drawer>
    )
}
