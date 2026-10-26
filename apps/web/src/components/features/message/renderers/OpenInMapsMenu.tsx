import type { ReactElement } from "react"
import { SheetRow } from "@components/features/schedule-send/ScheduleSendSheet"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import _ from "@lib/translate"
import { openExternal, type MapsOption } from "../../../../native/openMaps"

const choose = (option: MapsOption, close: () => void) => {
    close()
    void openExternal(option.url, option.fallbackUrl)
}

/**
 * The card wrapper and its desktop dropdown. The root stays mounted so the
 * card keeps its state; content only mounts while open.
 */
export const OpenInMapsMenu = ({
    options,
    open,
    onOpenChange,
    trigger,
}: {
    options: MapsOption[]
    open: boolean
    onOpenChange: (open: boolean) => void
    trigger: ReactElement
}) => (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        {open && (
            <DropdownMenuContent align="start" sideOffset={6} className="min-w-48">
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.id}
                        onSelect={() => choose(option, () => onOpenChange(false))}
                    >
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        )}
    </DropdownMenu>
)

/** Bottom-sheet choices, mounted only while a sheet is open. */
export const MapsSheet = ({
    options,
    onClose,
}: {
    options: MapsOption[]
    onClose: () => void
}) => (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
        <DrawerContent onOpenAutoFocus={(event) => event.preventDefault()}>
            <DrawerTitle className="sr-only">{_("Open location in maps")}</DrawerTitle>
            <DrawerDescription className="sr-only">{_("Choose a maps app")}</DrawerDescription>
            <div className="flex flex-col gap-1 p-3 pb-6">
                {options.map((option) => (
                    <SheetRow key={option.id} onClick={() => choose(option, onClose)}>
                        {option.label}
                    </SheetRow>
                ))}
            </div>
        </DrawerContent>
    </Drawer>
)
