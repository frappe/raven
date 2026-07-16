import { X, MoreVertical, LogOut, Trash2, ChevronLeft, ArrowUpRight } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { useMatch } from "react-router-dom"
import _ from "@lib/translate"
import { useIsMobile } from "@hooks/use-mobile"
import { useMobileBack } from "@hooks/useMobileBack"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"

export interface ThreadHeaderProps {
    /** Close the thread (route back to the parent channel). */
    onClose: () => void
    /** Open the parent channel with this thread open and its root message selected.
     *  Absent while the parent channel isn't known yet (cold deep-link resolving). */
    onOpenChannel?: () => void
    /** Leave the thread. */
    onLeave: () => void
    /** Open the delete confirmation (owned by ThreadDrawer, so its Esc can gate on it). */
    onRequestDelete: () => void
    /** Leave request in flight. */
    leaving?: boolean
    /** You're a participant — only members can leave. */
    canLeave: boolean
    /** You're a thread admin — only admins can delete. */
    canDelete: boolean
}

/** The thread drawer's title bar: name, the actions menu (leave / delete), and close.
 *  Mobile shows a BACK chevron on the left (threads are full-page there — back, not
 *  close, is the right affordance); desktop keeps the X on the right. */
export const ThreadHeader = ({ onClose, onOpenChannel, onLeave, onRequestDelete, leaving, canLeave, canDelete }: ThreadHeaderProps) => {

    const isMobile = useIsMobile()
    // Pop history so back lands wherever the thread was opened from (channel, threads
    // page, notifications). Cold start (push notification / deep link) has no history —
    // the hook then repairs the stack with the threads page (or the notifications page
    // when hosted there) beneath, so the OS back-swipe works too.
    const inNotifications = !!useMatch("/notifications/*")
    const goBack = useMobileBack(inNotifications ? "/notifications" : "/threads")

    return <div className="flex items-center justify-between h-11 pl-2 pr-4 md:pl-4 md:pr-2 py-0 md:py-2 border-b shrink-0">
        <div className="flex min-w-0 items-center gap-1">
            <div className="flex items-center justify-center md:hidden">
                <Button variant="ghost" size="lg" isIconButton onClick={goBack} aria-label={_("Back")}>
                    <ChevronLeft className="size-6" />
                </Button>
            </div>
            <h2 className="md:text-base md:font-medium text-lg-medium text-ink-gray-8">{_("Thread")}</h2>
        </div>
        <div className="flex items-center gap-2">
            {onOpenChannel && !isMobile && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size={isMobile ? "lg" : "sm"} isIconButton onClick={onOpenChannel} aria-label={_("Open channel")}>
                            <ArrowUpRight />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {_("Open in channel")}
                    </TooltipContent>
                </Tooltip>

            )}
            {/* Only show the menu if there's an action you're allowed to take. */}
            {(canLeave || canDelete) && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size={isMobile ? "lg" : "sm"} isIconButton aria-label={_("Thread settings")}>
                            <MoreVertical />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {canLeave && (
                            <DropdownMenuItem onClick={onLeave} disabled={leaving}>
                                <LogOut />
                                {_("Leave thread")}
                            </DropdownMenuItem>
                        )}
                        {canDelete && (
                            <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
                                <Trash2 />
                                {_("Delete thread")}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {/* Desktop-only: mobile uses the back chevron instead. */}
            <Button variant="ghost" size="sm" isIconButton onClick={onClose} aria-label={_("Close thread")} className="max-md:hidden">
                <X />
            </Button>
        </div>
    </div>
}
