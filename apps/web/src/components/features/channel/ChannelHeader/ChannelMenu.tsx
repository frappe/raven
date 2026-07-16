import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon";
import { Button } from "@components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { useChannel } from "@hooks/useChannel";
import { useIsMobile } from "@hooks/use-mobile";
import { type DrawerType } from "@utils/channelAtoms";
import { useOpenChannelDrawer } from "@hooks/useChannelDrawer";
import {
    Bell,
    BellOff,
    BellRing,
    ChevronDown,
    Settings,
    Users,
    Files,
    Link,
    MessageSquareText
} from "lucide-react";
import _ from "@lib/translate";

export type NavProps = {
    setDrawerType: (type: DrawerType) => void
}

const ChannelMenu = ({ channelID }: { channelID: string }) => {
    const { channel } = useChannel(channelID)
    const isMobile = useIsMobile()
    const setDrawerType = useOpenChannelDrawer(channelID)

    if (!channel) return null

    const navProps: NavProps = { setDrawerType }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size={isMobile ? "md" : "sm"} className="min-w-0 shrink">
                    <div className="flex items-center gap-1 min-w-0">
                        <ChannelIcon type={channel.type} className="size-4.5 md:size-4 shrink-0" />
                        <span className="text-lg md:text-base font-medium truncate min-w-0">
                            {channel.channel_name}
                        </span>
                    </div>
                    <ChevronDown className="hidden md:block shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                <SettingsButton {...navProps} />
                <ChannelFilesButton {...navProps} />
                <ChannelLinksButton {...navProps} />
                <ChannelThreadsButton {...navProps} />

                <MembersButton {...navProps} />
                {!isMobile && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Bell />
                            <span>{_("Push notifications")}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44">
                            <DropdownMenuItem onClick={() => { }}>
                                <BellRing />
                                <span>{_("All Notifications")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { }}>
                                <Bell />
                                <span>{_("Mentions Only")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { }}>
                                <BellOff />
                                <span>{_("Mute Channel")}</span>
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const SettingsButton = ({ setDrawerType }: NavProps) => {
    const onOpen = () => setDrawerType('settings')
    return (
        <DropdownMenuItem onClick={onOpen}>
            <Settings />
            <span>{_("Settings")}</span>
        </DropdownMenuItem>
    )
}

export const ChannelFilesButton = ({ setDrawerType }: NavProps) => {
    const onOpen = () => setDrawerType('files')
    return (
        <DropdownMenuItem onClick={onOpen}>
            <Files />
            <span>{_("Files")}</span>
        </DropdownMenuItem>
    )
}

export const ChannelLinksButton = ({ setDrawerType }: NavProps) => {
    const onOpen = () => setDrawerType('links')
    return (
        <DropdownMenuItem onClick={onOpen}>
            <Link />
            <span>{_("Links")}</span>
        </DropdownMenuItem>
    )
}

export const ChannelThreadsButton = ({ setDrawerType }: NavProps) => {
    const onOpen = () => setDrawerType('threads')
    return (
        <DropdownMenuItem onClick={onOpen}>
            <MessageSquareText />
            <span>{_("Threads")}</span>
        </DropdownMenuItem>
    )
}

const MembersButton = ({ setDrawerType }: NavProps) => {
    const onOpen = () => setDrawerType('members')
    return (
        <DropdownMenuItem onClick={onOpen}>
            <Users />
            <span>{_("Channel members")}</span>
        </DropdownMenuItem>
    )
}

export default ChannelMenu
