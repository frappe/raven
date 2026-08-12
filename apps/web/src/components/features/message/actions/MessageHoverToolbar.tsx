import { Fragment, useState } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { MoreHorizontal, Reply, SmilePlus } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@components/ui/tooltip"
import { messageActionTargetAtom } from "@utils/channelAtoms"
import _ from "@lib/translate"
import { useMessageActions } from "./useMessageActions"
import { useToggleReaction } from "./useToggleReaction"
import { ReactionPicker } from "./ReactionPicker"
import type { Message } from "@raven/types/common/Message"
import { QuickEmojisAtom } from "@utils/preferences"
import { useIsMobile } from "@hooks/use-mobile"

/**
 * The floating quick-action toolbar — ONE instance per stream, positioned over
 * the hovered message's top-right corner by MessageActionMenu's hover tracking.
 *
 * Carries the hovered message's data-message-id so the delegated hover handler
 * treats the toolbar as part of the message (otherwise hovering the toolbar
 * itself would clear the hover and dismiss it under the cursor).
 */
export const MessageHoverToolbar = ({
    message,
    top,
    canInteract = true,
    onMenuOpenChange,
    onOpenFullMenu,
}: {
    message: Message
    /** Offset from the stream wrapper's top, computed at hover time. */
    top: number
    /** From the host's composer gate — see MessageActionMenu. */
    canInteract?: boolean
    /** Lets the hover tracker keep the toolbar mounted while the menu is open. */
    onMenuOpenChange: (open: boolean) => void
    /** Mobile: the ellipsis opens the action bottom sheet instead of an inline dropdown. */
    onOpenFullMenu?: () => void
}) => {
    const [menuOpen, setMenuOpen] = useState(false)
    // File actions are built ONLY while the ellipsis dropdown is open — the three buttons
    // below need reply/create-thread/edit, none of which touch files, and building the file
    // actions scans the channel's loaded window to resolve the message's batch. Hover fires
    // per message the pointer crosses; the dropdown opens deliberately.
    const { groups: actionGroups, isOwner } = useMessageActions(message, {
        canInteract,
        includeFileActions: menuOpen,
    })
    // Promoted to toolbar icons (v2 parity). Their availability rules live in
    // useMessageActions — reply/create-thread only for channel MEMBERS, edit only
    // for the owner's own non-bot messages — so absence from the groups means
    // "don't show", no duplicated conditions here.
    const flatActions = actionGroups.flat()
    const createThreadAction = flatActions.find((action) => action.id === "create-thread")
    const editAction = flatActions.find((action) => action.id === "edit")
    // One toolbar-only rule: no quick Reply on your OWN messages (Edit sits in that
    // slot instead). Replying to yourself stays possible via the full menu — which
    // is why this is a presentation filter here, using the hook's own isOwner.
    const replyAction = isOwner ? undefined : flatActions.find((action) => action.id === "reply")
    const setActionTarget = useSetAtom(messageActionTargetAtom)
    const toggleReaction = useToggleReaction()
    const isMobile = useIsMobile()

    /** The ellipsis menu marks the message as the action target, like right-click does. */
    const handleMenuOpenChange = (open: boolean) => {
        setMenuOpen(open)
        setActionTarget(open ? message : null)
        onMenuOpenChange(open)
    }

    const quickEmojis = useAtomValue(QuickEmojisAtom)

    return (
        <div
            data-message-id={message.name}
            data-hover-toolbar
            // z-30: must float above the sticky date separators (z-20)
            className="absolute right-4 z-40 flex items-center gap-0.5 rounded-md border border-outline-gray-2 bg-surface-base p-0.5 shadow-xs"
            style={{ top }}
        >
            {/* One provider for the whole toolbar: after the first tooltip shows,
                moving across the icons shows the next ones instantly (skip delay) —
                the standard toolbar feel. */}
            <TooltipProvider delayDuration={400}>
                {/* No tooltips on the quick emojis — the emoji IS the label. */}
                {quickEmojis.slice(0, 4).map((emoji) => (
                    <Button
                        key={emoji.id}
                        variant="ghost"
                        size={isMobile ? "lg" : "md"}
                        isIconButton
                        aria-label={`${_("React with {0}", [emoji.native ? emoji.native : emoji.id ?? ""])}`}
                        onClick={() => toggleReaction(message, emoji.native ? emoji.native : emoji.src ?? "", emoji.src ? true : false, emoji.id)}
                    >
                        {emoji.src ? (
                            <img
                                src={emoji.src}
                                alt={emoji.id}
                                loading="lazy"
                                className="md:h-4.5 md:w-4.5 h-5 w-5 object-contain"
                                aria-hidden="true"
                            />
                        ) : (
                            // em-emoji renders from the Apple set (initialized in
                            // App.tsx) so reactions look the same on every platform
                            <span className="flex md:h-4.5 md:w-4.5 h-5 w-5 items-center justify-center" aria-hidden="true">
                                <em-emoji native={emoji.native} set="native" size="1.1em" fallback={emoji.id} />
                            </span>
                        )}
                    </Button>
                ))}
                <ReactionPicker message={message} tooltip={_("Add reaction")} side="bottom" align="end" onOpenChange={onMenuOpenChange}>
                    <Button variant="ghost" size={isMobile ? "lg" : "md"} isIconButton aria-label={_("Add reaction")}>
                        <SmilePlus />
                    </Button>
                </ReactionPicker>
                {replyAction && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size={isMobile ? "lg" : "md"}
                                isIconButton
                                aria-label={replyAction.label}
                                onClick={replyAction.onSelect}
                            >
                                {replyAction.icon && <replyAction.icon />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{replyAction.label}</TooltipContent>
                    </Tooltip>
                )}

                {createThreadAction && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size={isMobile ? "lg" : "md"}
                                isIconButton
                                aria-label={createThreadAction.label}
                                onClick={createThreadAction.onSelect}
                            >
                                {createThreadAction.icon && <createThreadAction.icon />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{createThreadAction.label}</TooltipContent>
                    </Tooltip>
                )}

                {editAction && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size={isMobile ? "lg" : "md"}
                                isIconButton
                                aria-label={editAction.label}
                                onClick={editAction.onSelect}
                            >
                                {editAction.icon && <editAction.icon />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{editAction.label}</TooltipContent>
                    </Tooltip>
                )}

                {onOpenFullMenu ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size={isMobile ? "lg" : "md"}
                                isIconButton
                                aria-label={_("More actions")}
                                onClick={onOpenFullMenu}
                            >
                                <MoreHorizontal />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{_("More actions")}</TooltipContent>
                    </Tooltip>
                ) : (
                    <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size={isMobile ? "lg" : "md"} isIconButton aria-label={_("More actions")}>
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>{_("More actions")}</TooltipContent>
                        </Tooltip>
                    <DropdownMenuContent align="end" className="w-56">
                        {actionGroups.map((group, index) => (
                            <Fragment key={index}>
                                {index > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuGroup>
                                    {group.map((action) =>
                                        action.children ? (
                                            // Nested ACTION ROWS (custom actions).
                                            <DropdownMenuSub key={action.id}>
                                                <DropdownMenuSubTrigger>
                                                    {action.icon && <action.icon />}
                                                    <span>{action.label}</span>
                                                </DropdownMenuSubTrigger>
                                                {/* Content-sized between the primitive's min-w-[8rem] floor and a
                                                    max-w cap: action_name is an unbounded Data field (140 chars),
                                                    so a long admin label truncates instead of sprawling the panel. */}
                                                <DropdownMenuSubContent className="max-w-64">
                                                    {action.children.map((child) => (
                                                        <DropdownMenuItem key={child.id} onSelect={child.onSelect}>
                                                            {child.icon && <child.icon />}
                                                            <span className="truncate">{child.label}</span>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                        ) : action.submenu ? (
                                            // Nested PANEL content (read receipts) — same content the
                                            // context menu nests, mounted only once the submenu opens.
                                            <DropdownMenuSub key={action.id}>
                                                <DropdownMenuSubTrigger>
                                                    {action.icon && <action.icon />}
                                                    <span>{action.label}</span>
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent>{action.submenu()}</DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                        ) : (
                                            <DropdownMenuItem
                                                key={action.id}
                                                variant={action.danger ? "destructive" : "default"}
                                                onSelect={action.onSelect}
                                            >
                                                {action.icon && <action.icon />}
                                                <span>{action.label}</span>
                                            </DropdownMenuItem>
                                        ),
                                    )}
                                </DropdownMenuGroup>
                            </Fragment>
                        ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </TooltipProvider>
        </div>
    )
}
