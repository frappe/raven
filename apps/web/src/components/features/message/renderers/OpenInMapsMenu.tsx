import { SheetRow } from "@components/features/schedule-send/ScheduleSendSheet"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import _ from "@lib/translate"
import { openExternal, type MapsOption } from "../../../../native/openMaps"
import { BrandIcon, MAPS_BRAND } from "./BrandIcons"

const choose = (option: MapsOption, close: () => void) => {
    close()
    void openExternal(option.url, option.fallbackUrl)
}

/** The desktop dropdown, anchored on an inert trigger covering the card, so a flipped menu clears it. */
export const OpenInMapsMenu = ({
    options,
    onClose,
    onCloseAutoFocus,
}: {
    options: MapsOption[]
    onClose: () => void
    onCloseAutoFocus: () => void
}) => (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
        <DropdownMenuTrigger asChild>
            <span className="pointer-events-none absolute inset-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="min-w-48"
            onCloseAutoFocus={(event) => {
                event.preventDefault()
                onCloseAutoFocus()
            }}
        >
            <DropdownMenuLabel>{_("Open in")}</DropdownMenuLabel>
            {options.map((option) => (
                <DropdownMenuItem key={option.id} onSelect={() => choose(option, onClose)}>
                    <BrandIcon brand={MAPS_BRAND[option.id]} className="size-4 shrink-0" />
                    {option.label}
                </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
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
            <DrawerDescription className="sr-only">{_("Choose a maps app")}</DrawerDescription>
            <div className="flex flex-col gap-1 p-3 pb-6">
                {/* Section heading style, as in the schedule-send sheet. */}
                <DrawerTitle className="px-3 pb-1 pt-2 text-left text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                    {_("Open in")}
                </DrawerTitle>
                {options.map((option) => (
                    <SheetRow key={option.id} onClick={() => choose(option, onClose)}>
                        <BrandIcon brand={MAPS_BRAND[option.id]} className="size-6 shrink-0" />
                        {option.label}
                    </SheetRow>
                ))}
            </div>
        </DrawerContent>
    </Drawer>
)
