import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { ArrowUpRight, ChevronLeft, Pin, Star } from "lucide-react"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import ChannelMembers from "./ChannelMembers"
import ChannelMenu from "./ChannelMenu"
import { useAtomValue } from "jotai"
import { channelDrawerAtom } from "@utils/channelAtoms"
import { useOpenChannelDrawer } from "@hooks/useChannelDrawer"
import { useLocation, useParams } from "react-router-dom"
import { useChannel } from "@hooks/useChannel"
import { useIsMobile } from "@hooks/use-mobile"
import { PANE_HOSTS, useMobileBack } from "@hooks/useMobileBack"
import _ from "@lib/translate"

interface ChannelHeaderProps {
    /** Override the URL-derived channel id. Used when this header is rendered outside
     * a `/:workspaceID/:id` route (eg. notifications view) and `useCurrentChannelID`
     * would otherwise fall back to `"general"`. */
    channelID: string
    /** Hide the drawer-opening actions (menu, pins, members, star). Off on DESKTOP in
     * the notifications/search/saved panes, purely for space: the pane is too narrow
     * for the drawer rail those actions open. (Mobile panes keep them — drawers are
     * bottom sheets there, and they resolve their channel via CurrentChannelContext.) */
    showActions?: boolean
    /** Show an "Open channel" button that navigates to the channel's full page —
     * provided by panes (notifications/search/saved) as the way out of the pane. */
    onOpenChannel?: () => void
}

const ChannelHeader = ({ channelID, showActions = true, onOpenChannel }: ChannelHeaderProps) => {
    const { channel, toggleStarChannel, isStarred } = useChannel(channelID)
    const { workspaceID } = useParams()
    const isMobile = useIsMobile()

    // Mobile back: pop history, so it lands wherever this chat was opened from
    // (channel list, notifications, …). The cold-start fallback comes from the
    // route this header is rendered under.
    // Chat-pane hosts render this header inside their chat child route — a cold start
    // there gets the host's LIST synthesized beneath it, not a workspace.
    const pathname = useLocation().pathname
    const paneHost = PANE_HOSTS.find((p) => pathname.startsWith(p + "/"))
    // With a thread open ON TOP (mobile layer), the thread header owns the cold-start
    // stack repair (its parent is the threads page) — this covered header stands down.
    const threadOnTop = pathname.includes("/thread/")
    const goBack = useMobileBack(paneHost ?? `/${workspaceID ?? ""}`, { repairStack: !threadOnTop })

    const pinnedCount = channel?.pinned_messages_string ? channel.pinned_messages_string.split("\n").length : 0

    const drawerType = useAtomValue(channelDrawerAtom(channelID))
    const setDrawerType = useOpenChannelDrawer(channelID)

    const onOpenMembers = () => {
        setDrawerType(drawerType === 'members' ? '' : 'members')
    }

    const onOpenPins = () => {
        setDrawerType('pins')
    }

    const shouldShowActions = isMobile ? true : showActions

    return (
        <div
            className="flex w-full shrink-0 items-center justify-between border-b border-outline-gray-2 bg-surface-base h-11 px-2"
        >
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

            {/* Left side */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-0.5 min-w-0">
                    {shouldShowActions && (
                        <div className="items-center justify-center hidden md:flex">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size={isMobile ? "md" : "sm"} isIconButton className={isStarred ? "text-yellow-400" : ""} aria-label={_('Star')} onClick={toggleStarChannel}>
                                        <Star className={`size-4.5 md:size-4 ${isStarred ? "fill-yellow-400" : ""}`} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {_('Add to Favorites')}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    )}

                    {shouldShowActions ? (
                        <ChannelMenu channelID={channelID} />
                    ) : (
                        // Plain title (same look as ChannelMenu's trigger) — no dropdown.
                        <div className="flex items-center gap-1 min-w-0 px-1.5">
                            <ChannelIcon type={channel?.type ?? "Public"} className="size-4.5 md:size-4 shrink-0" />
                            <span className="text-lg md:text-sm font-medium truncate">{channel?.channel_name}</span>
                        </div>
                    )}

                    {shouldShowActions && pinnedCount > 0 && <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size={isMobile ? "md" : "sm"} onClick={onOpenPins} aria-label={_('View Pinned Messages')}>
                                <Pin className="size-4.5 md:size-4" />
                                <span className="sr-only">{_('View Pinned Messages')}</span>
                                <span className="text-ink-gray-6 text-sm">{pinnedCount}</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{_('Pinned Messages')}</p>
                        </TooltipContent>
                    </Tooltip>}
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1 ml-auto shrink-0 pl-1">
                {onOpenChannel && !isMobile && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size={isMobile ? "lg" : "sm"} isIconButton onClick={onOpenChannel} aria-label={_('Open channel')}>
                                <ArrowUpRight />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{_('Open channel')}</TooltipContent>
                    </Tooltip>
                )}
                {shouldShowActions && <ChannelMembers onClick={onOpenMembers} channelID={channelID} />}
            </div>
        </div>
    )
}

export default ChannelHeader