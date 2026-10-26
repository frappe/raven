import type { ReactElement } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import _ from "@lib/translate"
import { openExternal, type MapsOption } from "../../../../native/openMaps"

const sheetRowClass =
    "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-base text-ink-gray-8 active:bg-surface-gray-2 md:text-sm"

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
                        className="min-h-11 text-base md:min-h-0 md:text-sm"
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
            <div className="flex flex-col gap-1 p-2 pb-4">
                {options.map((option) => (
                    <button key={option.id} type="button" className={sheetRowClass} onClick={() => choose(option, onClose)}>
                        {option.label}
                    </button>
                ))}
            </div>
        </DrawerContent>
    </Drawer>
)
