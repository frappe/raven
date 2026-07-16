import { lazy, Suspense, useState } from 'react'
import { FilterIcon, MoreVertical, PlusIcon, SidebarIcon } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Spinner } from '@components/ui/spinner'
import {
    Dialog,
    DialogContent,
} from '@components/ui/dialog'
import {
    Drawer,
    DrawerContent,
} from '@components/ui/drawer'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import { CreateChannelDialog } from '@components/features/channel/CreateChannel/CreateChannelButton'
import _ from "@lib/translate"
import { useIsMobile } from '@hooks/use-mobile'
import { useSetAtom } from 'jotai'
import { settingsDialogOpenTab } from '@components/features/settings/SettingsDialog'
import { Hash } from '@components/common/ChannelIcon/ChannelIcon'

// Lazy for the same reason the settings dialog lazies its panels: this is the
// OTHER importer of CustomizeSidebarDialog, and one eager import anywhere would
// pull the module back into the main bundle for both. Radix only renders
// Dialog/Drawer content while open, so the chunk loads on first open.
const CustomizeSidebarDialog = lazy(() =>
    import('./CustomizeSidebarDialog').then((m) => ({ default: m.CustomizeSidebarDialog })),
)

/** The channel sidebar's overflow menu — create channel + sidebar view options. */
export const CustomizeSidebarButton = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    const setSettingsDialogAtom = useSetAtom(settingsDialogOpenTab)
    const isMobile = useIsMobile()

    const content = (
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner /></div>}>
            <CustomizeSidebarDialog onClose={() => setIsOpen(false)} />
        </Suspense>
    )

    return (
        <>
            {isMobile ? (
                <Drawer open={isOpen} onOpenChange={setIsOpen}>
                    <DrawerContent className="h-[90vh] flex flex-col">
                        {content}
                    </DrawerContent>
                </Drawer>
            ) : (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="md:max-w-[70vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
                        {content}
                    </DialogContent>
                </Dialog>
            )}

            <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size={isMobile ? "lg" : "sm"}
                        isIconButton
                        aria-label={_("Channel options")}
                    >
                        <MoreVertical />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="min-w-64">
                    {!isMobile && <DropdownMenuItem onClick={() => setSettingsDialogAtom('preferences')}>
                        <FilterIcon />{_("Filter and Sort")}
                    </DropdownMenuItem>}
                    {!isMobile && <DropdownMenuItem onClick={() => setSettingsDialogAtom('sidebar')}>
                        <SidebarIcon />{_("Customize Sidebar")}
                    </DropdownMenuItem>}
                    {!isMobile && <DropdownMenuItem onClick={() => setSettingsDialogAtom('channels')}>
                        <Hash />{_("Manage Channels")}
                    </DropdownMenuItem>}
                    {!isMobile && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                        <PlusIcon />{_("Create a new channel")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
