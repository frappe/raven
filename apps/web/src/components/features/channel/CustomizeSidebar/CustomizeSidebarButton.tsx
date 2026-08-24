import { useState } from 'react'
import { FilterIcon, MoreVertical, PlusIcon, SidebarIcon } from 'lucide-react'
import { Button } from '@components/ui/button'
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
import { settingsDialogOpenTab } from '@components/features/settings/settingsDialogAtom'
import { Hash } from '@components/common/ChannelIcon/ChannelIcon'

/** The channel sidebar's overflow menu — create channel + sidebar view options. */
export const CustomizeSidebarButton = () => {
    const [createOpen, setCreateOpen] = useState(false)

    const setSettingsDialogAtom = useSetAtom(settingsDialogOpenTab)
    const isMobile = useIsMobile()

    return (
        <>
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
                    {/* Desktop only: AppShellLayout doesn't mount RavenSettingsDialog on
                        mobile, so setting the tab atom there would do nothing at all. */}
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
