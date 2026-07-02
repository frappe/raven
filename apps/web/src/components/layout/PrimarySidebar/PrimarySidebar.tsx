import { commandMenuOpenAtom } from "@components/features/cmdk/atoms"
import NavUserMenu from "@components/features/header/NavUserMenu/NavUserMenu"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import { KeyboardMetaKeyIcon } from "@components/ui/keyboard-keys"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@components/ui/tooltip"
import { useUnreadNotificationsCount } from "@hooks/useNotifications"
import { useWorkspaces, type WorkspaceFields } from "@hooks/useWorkspaces"
import { useDMUnread, useWorkspaceUnread } from "@stores/unread/useChannelUnread"
import { useUnreadThreadsCount } from "@stores/threads/useUnreadThreads"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { useSetAtom } from "jotai"
import { BellIcon, BookmarkIcon, MessageSquareTextIcon, MoreHorizontalIcon, SearchIcon, UsersRoundIcon } from "lucide-react"
import { NavLink } from "react-router"
import { settingsDialogOpenTab } from "@components/features/settings/SettingsDialog"

const RavenLogo = () => {
    return <img src="/assets/raven/raven_logo.svg" alt="Raven Logo" className="w-8 h-8" />
}

/**
 * Component to render the first sidebar - only used on Desktop. 
 * The component has navigation links to pages, the user avatar with logout and a settings button.
 */
const PrimarySidebar = () => {
    return (
        <TooltipProvider>
            <div className="flex flex-col h-full gap-2 shrink-0 justify-between items-center border-r border-outline-gray-2 bg-surface-sidebar w-(--primary-sidebar-width) pb-4 pt-2.5">
                <div className="flex flex-col items-center gap-3">
                    <RavenLogo />
                    <div className="px-3.5 w-full">
                        <Separator />
                    </div>
                    <NotificationsLink />
                    <DirectMessagesLink />
                    <ThreadsLink />
                    <div className="px-3.5 w-full">
                        <Separator />
                    </div>
                    <WorkspaceList />
                </div>
                <div className="flex flex-col items-center gap-3">
                    <div className="px-3.5 w-full">
                        <Separator />
                    </div>
                    <SearchButton />
                    <SavedMessageLink />
                    <NavUserMenu />
                </div>
            </div>
        </TooltipProvider>
    )
}

const SearchButton = () => {
    const setOpen = useSetAtom(commandMenuOpenAtom)
    return <Tooltip>
        <TooltipTrigger asChild>
            <Button
                variant="subtle"
                size="md"
                isIconButton onClick={() => setOpen(true)}
                aria-label={_("Command Menu")}>
                <SearchIcon className="size-4" />
            </Button >

        </TooltipTrigger>
        <TooltipContent side="right" align="center">
            <div>
                {_("Search")}  <span className="ms-1 text-ink-gray-4">
                    <KeyboardMetaKeyIcon />K
                </span>
            </div>
        </TooltipContent>

    </Tooltip>
}

const IconBox = ({ children, isActive, title }: { children: React.ReactNode, isActive?: boolean, title?: string }) => {
    return <Tooltip>
        <TooltipTrigger asChild>
            <div className="relative w-(--primary-sidebar-width) flex items-center justify-center group/icon-box">
                <ActivePill isActive={isActive} />
                <div data-active={isActive} className={cn(
                    "relative flex items-center justify-center size-8 [&>svg]:size-4 rounded transition-all duration-200",
                    "hover:bg-surface-gray-3 bg-surface-gray-2 text-ink-gray-8",
                    "data-active:bg-surface-gray-4 data-active:hover:bg-surface-gray-4"
                )}>
                    {children}
                </div>
            </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
            {title}
        </TooltipContent>
    </Tooltip>
}

const ActivePill = ({ isActive }: { isActive?: boolean }) => {
    return <div className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-colors h-6 ease-in duration-200",
        isActive ? "bg-surface-gray-7" : "bg-transparent"
    )} />
}

const UnreadBadge = ({ count }: { count?: number }) => {

    if (!count || count === 0) return null

    // Pill, not a fixed circle: a single digit stays circular (min-w == height),
    // but "9+" / two digits grow horizontally with px-1 so the glyphs aren't
    // crushed against the boundary. h-4 keeps the cap height stable either way.
    return <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-surface-red-6 dark:bg-surface-red-6 text-ink-base dark:text-ink-red-1 text-[10px] leading-none">
        {count > 9 ? "9+" : count}
    </span>

}

const NotificationsLink = () => {

    const { data: unreadCountData } = useUnreadNotificationsCount()
    const unreadCount = unreadCountData?.message ?? 0

    return <NavLink to="notifications">
        {({ isActive }) => (
            <IconBox isActive={isActive} title={_("Notifications")}>
                <BellIcon />
                <UnreadBadge count={unreadCount} />
            </IconBox>
        )}
    </NavLink>
}

const DirectMessagesLink = () => {
    const unread = useDMUnread()

    return <NavLink to="dm-channel">
        {({ isActive }) => (
            <IconBox isActive={isActive} title={_("Direct Messages")}>
                <UsersRoundIcon />
                <UnreadBadge count={unread} />
            </IconBox>
        )}
    </NavLink>
}

const ThreadsLink = () => {
    const unread = useUnreadThreadsCount()

    return <NavLink to="threads">
        {({ isActive }) => (
            <IconBox isActive={isActive} title={_("Threads")}>
                <MessageSquareTextIcon />
                <UnreadBadge count={unread} />
            </IconBox>
        )}
    </NavLink>
}

const SavedMessageLink = () => {
    return <NavLink to="saved-messages">
        {({ isActive }) => (
            <IconBox isActive={isActive} title={_("Saved Messages")}>
                <BookmarkIcon />
            </IconBox>
        )}
    </NavLink>
}

const WorkspaceList = () => {

    const { workspaces } = useWorkspaces()

    const myWorkspaces = workspaces.filter((workspace) => workspace.workspace_member_name)

    const hasMoreWorkspaces = workspaces.length > myWorkspaces.length

    const setSettingsDialogOpenTab = useSetAtom(settingsDialogOpenTab)

    return <div className="flex flex-col items-center gap-3">
        {myWorkspaces.map((workspace) => (
            <WorkspaceItem key={workspace.name} workspace={workspace} />
        ))}
        {hasMoreWorkspaces && <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="subtle" size="md" isIconButton aria-label={_("Manage Workspaces")} onClick={() => setSettingsDialogOpenTab("workspaces")}>
                    <MoreHorizontalIcon className="size-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
                {_("Manage Workspaces")}
            </TooltipContent>
        </Tooltip>
        }
    </div>
}

const WorkspaceItem = ({ workspace }: { workspace: WorkspaceFields }) => {
    const unread = useWorkspaceUnread(workspace.name)

    return <NavLink to={`/${workspace.name}`}>
        {({ isActive }) => (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative w-(--primary-sidebar-width) flex items-center justify-center group/icon-box">
                        <ActivePill isActive={isActive} />
                        {/* Badge anchors to the avatar, not the full-width rail cell */}
                        <div className="relative">
                            <Avatar className="w-8 h-8 rounded">
                                <AvatarImage src={workspace.logo} alt={workspace.workspace_name} />
                                <AvatarFallback className="text-xs bg-surface-gray-2 text-ink-gray-7">
                                    {workspace.workspace_name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <UnreadBadge count={unread} />
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                    {workspace.workspace_name}
                </TooltipContent>
            </Tooltip>
        )}
    </NavLink>
}

export default PrimarySidebar