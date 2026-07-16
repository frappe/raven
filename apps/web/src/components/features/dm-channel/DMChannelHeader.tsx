import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { OnLeaveBadge } from "@components/common/OnLeaveBadge"
import { ArrowUpRight, Bot, ChevronDown, ChevronLeft, Files, Link, MessageSquareText, Pin, User, UserX } from "lucide-react"
import { useLocation, useMatch } from "react-router-dom"
import { useMobileBack } from "@hooks/useMobileBack"
import { type DrawerType } from "@utils/channelAtoms"
import { useOpenChannelDrawer } from "@hooks/useChannelDrawer"
import { UserData } from "@db"
import _ from "@lib/translate"
import { useChannel } from "@hooks/useChannel"
import { useIsMobile } from "@hooks/use-mobile"

interface DMChannelHeaderProps {
    /** Peer user info (name, avatar). When from API this can extend to peer_user_id, etc. */
    peer: UserData
    /** Hide the drawer-opening actions (name dropdown, pins). Off on DESKTOP in the
     * notifications/search/saved panes, purely for space: the pane is too narrow for
     * the drawer rail those actions open. (Mobile panes keep them — drawers are
     * bottom sheets there, and they resolve their channel via CurrentChannelContext.) */
    showActions?: boolean
    /** Show an "Open channel" button that navigates to the DM's full page —
     * provided by panes (notifications/search/saved) as the way out of the pane. */
    onOpenChannel?: () => void
    /** DM channel id (for drawer state) */
    channelID: string
}

export function DMChannelHeader({ peer, channelID, showActions = true, onOpenChannel }: DMChannelHeaderProps) {
    // Mobile back: pop history, so it lands wherever this chat was opened from
    // (DM list, notifications, …). The cold-start fallback comes from the route
    // this header is rendered under.
    const inNotifications = !!useMatch("/notifications/*")
    // With a thread open ON TOP (mobile layer), the thread header owns the cold-start
    // stack repair (its parent is the threads page) — this covered header stands down.
    const threadOnTop = useLocation().pathname.includes("/thread/")
    const goBack = useMobileBack(inNotifications ? "/notifications" : "/dm-channel", { repairStack: !threadOnTop })
    const displayName = peer.full_name || peer.name
    const setDrawerType = useOpenChannelDrawer(channelID)
    const { dmChannel } = useChannel(channelID)
    const pinnedCount = dmChannel?.pinned_messages_string ? dmChannel.pinned_messages_string.split("\n").length : 0
    const customStatus = peer.custom_status?.trim() || ""
    const isBot = peer.type === "Bot"
    const isDisabled = peer.enabled === 0

    const openTab = (tab: Exclude<DrawerType, "" | "members">) => {
        setDrawerType(tab)
    }

    const isMobile = useIsMobile()

    const shouldShowActions = isMobile ? true : showActions

    return (
        <div
            // h-11 (not padding-driven): AppHeader matches this height on
            // mobile so list ↔ channel navigation doesn't jump the header
            className="flex h-11 w-full shrink-0 items-center justify-between border-b border-outline-gray-2 bg-surface-base px-2"
        >
            <div className="flex items-center w-full">
                <div className="flex items-center justify-center md:hidden">
                    <Button
                        variant="ghost"
                        size="lg"
                        isIconButton
                        onClick={goBack}
                        aria-label={_('Back')}
                    >
                        <ChevronLeft className="size-6" />
                    </Button>
                </div>

                {/* Left: Avatar/Name dropdown + pinned chip */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1">
                        {!shouldShowActions && (
                            // Plain identity (same look as the dropdown trigger) — no menu.
                            <div className="flex items-center gap-2 min-w-0 max-w-60 px-1.5 py-1">
                                <UserAvatar user={peer} size="sm" />
                                <span className="text-lg md:text-sm font-medium truncate">{displayName}</span>
                            </div>
                        )}
                        {shouldShowActions && <DropdownMenu>
                            <DropdownMenuTrigger asChild className="px-1.5">
                                <Button
                                    variant="ghost"
                                    size="md"
                                    className="gap-2 min-w-0 max-w-64 py-1"
                                >
                                    <UserAvatar
                                        user={peer}
                                        size="sm"
                                    />
                                    <span className="text-lg md:text-sm font-medium truncate">{displayName}</span>
                                    <ChevronDown className="hidden md:block shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuItem onClick={() => openTab("files")}>
                                    <User />
                                    <span>{_("View profile")}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openTab("files")}>
                                    <Files />
                                    <span>{_("Files")}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openTab("links")}>
                                    <Link />
                                    <span>{_("Links")}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openTab("threads")}>
                                    <MessageSquareText />
                                    <span>{_("Threads")}</span>
                                </DropdownMenuItem>
                                {/* <DropdownMenuSub>
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
                            </DropdownMenuSub> */}
                            </DropdownMenuContent>
                        </DropdownMenu>}

                        {isBot && (
                            <Badge size="md" variant="subtle" theme="violet">
                                <Bot />
                                {_("Bot")}
                            </Badge>
                        )}
                        {isDisabled && (
                            <Badge size="md" variant="subtle" theme="gray">
                                <UserX />
                                {_("Disabled")}
                            </Badge>
                        )}
                        <OnLeaveBadge userID={peer.name} size="md" />
                        {customStatus && !isMobile && (
                            <Badge size="md" variant="subtle" theme="gray" title={customStatus} className="max-w-96 md:flex hidden justify-start truncate">
                                {customStatus}
                            </Badge>
                        )}

                        {shouldShowActions && pinnedCount > 0 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2" onClick={() => openTab("pins")}>
                                        <Pin className="h-2 w-2 text-ink-gray-8/80" />
                                        <span className="sr-only">{_('Pinned')}</span>
                                        <span className="text-ink-gray-4 text-sm font-normal">{pinnedCount}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{_('Pinned Messages')}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Open channel (panes) + command menu (mobile) + Call */}
            {onOpenChannel && !isMobile && <div className="items-center gap-1 ml-auto flex">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" isIconButton onClick={onOpenChannel} aria-label={_("Open channel")}>
                            <ArrowUpRight />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{_("Open channel")}</TooltipContent>
                </Tooltip>
                {/* <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" isIconButton>
                            <Headset className="h-4 w-4 md:h-3 md:w-3 text-ink-gray-8/80" />
                            <span className="sr-only">{_("Start call")}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{_("Start call")}</p>
                    </TooltipContent>
                </Tooltip> */}
            </div>
            }
        </div>
    )
}
