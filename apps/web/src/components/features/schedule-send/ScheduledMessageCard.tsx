import { useEffect, useRef, useState } from "react"
import {
    CalendarClockIcon, Edit3Icon, EllipsisVerticalIcon, MessageSquareMore, SendHorizontalIcon, Trash2Icon,
} from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Drawer, DrawerContent, DrawerTitle } from "@components/ui/drawer"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { MessageBody } from "@components/features/message/renderers/MessageContent"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { useIsMobile } from "@hooks/use-mobile"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { DRAWER_EXIT_MS } from "@utils/drawer"
import { fromServerDatetime, formatDateTimeLabel } from "@lib/timeUtils"
import { InlineScheduledMessageEditor } from "./InlineScheduledMessageEditor"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import type { UserData } from "@db"

type ScheduledMessageCardProps = {
    row: ScheduledMessageRow
    /** Author — always the current user, resolved by the list. */
    user?: UserData
    /** Channel context — non-null for channel messages. */
    channel?: ChannelListItem
    /** DM channel context — non-null for DM messages. */
    dmChannel?: DMChannelListItem
    /** Peer user when the message lives in a DM. */
    peer?: UserData
    onSendNow: (row: ScheduledMessageRow) => void
    /** Name of the row currently being edited inline (null = none). */
    editingRowId: string | null
    /** Enter/exit inline-edit mode for this row. */
    onEditingChange: (id: string | null) => void
    /** Called after a successful inline save so the parent can refresh the list. */
    onRowSaved: () => void
    onDelete: (row: ScheduledMessageRow) => void
}

/**
 * One scheduled message as a message card (MessageResultBlock's markup — its
 * props can't express a scheduled row). Desktop: dropdown menu, Edit swaps the
 * body for the inline editor. Mobile: tapping the row opens an action sheet,
 * Edit opens a sheet hosted by the list. Send now / Delete confirm first.
 */

export const ScheduledMessageCard = ({
    row, user, channel, dmChannel, peer, onSendNow, editingRowId, onEditingChange, onRowSaved, onDelete,
}: ScheduledMessageCardProps) => {
    const isMobile = useIsMobile()
    const isFailed = row.status === "Failed"
    const isEditing = row.name === editingRowId
    const peerName = peer?.full_name ?? dmChannel?.peer_user_id ?? ""
    // Resolved destination label for the send-now confirmation (channel / DM peer).
    const channelLabel = channel ? channel.channel_name : peerName

    // Confirmation dialogs, opened from the row menu (menu closes first — the
    // same controlled-open pattern as WorkspaceActionMenu's delete confirm).
    const [sendNowOpen, setSendNowOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    // Mobile-only action sheet (row tap); desktop keeps the dropdown.
    const [actionsOpen, setActionsOpen] = useState(false)

    // Edit-defer timeout — cleared on unmount so a Virtuoso-recycled row
    // can't resurrect the edit sheet.
    const editDeferRef = useRef<number | null>(null)
    useEffect(() => () => {
        if (editDeferRef.current !== null) {
            window.clearTimeout(editDeferRef.current)
            editDeferRef.current = null
        }
    }, [])

    // Mobile: row tap opens the action sheet; long-press OS menu suppressed.
    const rowTapHandlers = isMobile && !isEditing ? {
        onClick: () => setActionsOpen(true),
        onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => event.preventDefault(),
    } : {}

    return (
        <div className="px-2 py-0.5">
            <div
                className={cn(
                    "group flex gap-3 px-2 py-3 md:py-2 rounded transition-colors text-left select-none hover:bg-surface-gray-3",
                    // CSS :active, not state — a Virtuoso-recycled instance can't
                    // highlight the wrong row.
                    "active:bg-surface-gray-3",
                    actionsOpen && "bg-surface-gray-3",
                )}
                {...rowTapHandlers}
            >
                {user && <UserAvatar user={user} size="md" showStatusIndicator={false} />}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap text-content">
                        {user && (
                            <span className="font-medium text-ink-gray-8 truncate">{user.full_name}</span>
                        )}
                        <span className="shrink-0 text-xs text-ink-gray-4 flex items-baseline gap-1">
                            <CalendarClockIcon className="h-3 w-3 self-center shrink-0 text-ink-gray-4" />
                            {_("Scheduled for {0}", [formatDateTimeLabel(fromServerDatetime(row.scheduled_time))])}
                        </span>
                        {channel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <ChannelIcon type={channel.type} className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{channel.channel_name}</span>
                            </>
                        )}
                        {dmChannel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <MessageSquareMore className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{peerName}</span>
                            </>
                        )}
                    </div>
                    {isEditing && !isMobile ? (
                        <InlineScheduledMessageEditor
                            row={row}
                            onDone={onRowSaved}
                            onCancel={() => onEditingChange(null)}
                        />
                    ) : (
                        <>
                            {isFailed && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                    <Badge variant="subtle" theme="red" className="self-start">{_("Failed")}</Badge>
                                    {row.error && <p className="whitespace-pre-line text-sm text-ink-red-6">{row.error}</p>}
                                </div>
                            )}
                            <div className="mt-1 [&_p]:my-0">
                                <MessageBody content={row.text} />
                            </div>
                        </>
                    )}
                </div>
                {!isEditing && (
                    <>
                        {!isMobile && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    isIconButton
                                    aria-label={_("Scheduled message actions")}
                                    className="shrink-0 self-start"
                                >
                                    <EllipsisVerticalIcon className="size-5 md:size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    className="text-base md:text-sm py-2.5 md:py-1.5"
                                    onClick={() => setSendNowOpen(true)}
                                >
                                    <SendHorizontalIcon />
                                    {_("Send now")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-base md:text-sm py-2.5 md:py-1.5"
                                    onClick={() => onEditingChange(row.name)}
                                >
                                    <Edit3Icon />
                                    {_("Edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="destructive"
                                    className="text-base md:text-sm py-2.5 md:py-1.5"
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2Icon />
                                    {_("Delete")}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        )}
                        {/* Mobile action sheet — the same three actions as the
                            dropdown, presented as a bottom sheet (a tap anywhere
                            on the row opens it). Rows close the sheet first,
                            then fire the existing behavior (AlertDialog over a
                            just-closed sheet is the house confirm pattern). */}
                        <Drawer open={actionsOpen} onOpenChange={setActionsOpen}>
                            <DrawerContent
                                // No focus restore — it would yank focus off the
                                // AlertDialog these rows open (same as MessageActionMenu).
                                onCloseAutoFocus={(event) => event.preventDefault()}
                            >
                                <DrawerTitle className="sr-only">{_("Scheduled message actions")}</DrawerTitle>
                                {/* MessageActionMenu's SheetActionRow anatomy. */}
                                <div className="flex flex-col px-2 pb-6">
                                    <Button
                                        variant="ghost"
                                        size="lg"
                                        theme="gray"
                                        className="w-full justify-start gap-3 active:bg-surface-gray-2"
                                        onClick={() => {
                                            setActionsOpen(false)
                                            setSendNowOpen(true)
                                        }}
                                    >
                                        <SendHorizontalIcon />
                                        {_("Send now")}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="lg"
                                        theme="gray"
                                        className="w-full justify-start gap-3 active:bg-surface-gray-2"
                                        onClick={() => {
                                            setActionsOpen(false)
                                            // Wait out the sheet's exit animation — flipping
                                            // isEditing in the same commit would unmount it
                                            // mid-animation while the edit Drawer mounts.
                                            if (editDeferRef.current !== null) {
                                                window.clearTimeout(editDeferRef.current)
                                            }
                                            editDeferRef.current = window.setTimeout(() => {
                                                editDeferRef.current = null
                                                onEditingChange(row.name)
                                            }, DRAWER_EXIT_MS)
                                        }}
                                    >
                                        <Edit3Icon />
                                        {_("Edit")}
                                    </Button>
                                    <div className="my-1 border-t border-outline-gray-2" />
                                    <Button
                                        variant="ghost"
                                        size="lg"
                                        theme="red"
                                        className="w-full justify-start gap-3 active:bg-surface-red-2"
                                        onClick={() => {
                                            setActionsOpen(false)
                                            setDeleteOpen(true)
                                        }}
                                    >
                                        <Trash2Icon />
                                        {_("Delete")}
                                    </Button>
                                </div>
                            </DrawerContent>
                        </Drawer>
                        {/* Confirmations — AlertDialogAction closes the dialog on click
                            (Radix), then the parent's send/delete handler runs. */}
                        <AlertDialog open={sendNowOpen} onOpenChange={setSendNowOpen}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{_("Send message now?")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {_("This message will be sent to {0} immediately.", [channelLabel])}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{_("Cancel")}</AlertDialogCancel>
                                    <AlertDialogAction theme="gray" onClick={() => onSendNow(row)}>
                                        {_("Send now")}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{_("Delete scheduled message?")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {_("This scheduled message will be permanently deleted.")}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{_("Cancel")}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(row)}>
                                        {_("Delete")}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
            </div>
        </div>
    )
}
