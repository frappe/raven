import { useEffect, useRef, useState } from "react"
import {
    Edit3Icon, EllipsisIcon, MessageSquareMore, MoonIcon, SendHorizontalIcon, SunIcon, Trash2Icon,
} from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import {
    ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from "@components/ui/context-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Drawer, DrawerContent, DrawerTitle } from "@components/ui/drawer"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { MessageBody } from "@components/features/message/renderers/MessageContent"
import { useMessageTimes } from "@components/features/message/renderers/MessageRow"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { useIsMobile } from "@hooks/use-mobile"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { DRAWER_EXIT_MS } from "@utils/drawer"
import { fromServerDatetime } from "@lib/timeUtils"
import { InlineScheduledMessageEditor } from "./InlineScheduledMessageEditor"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import type { UserData } from "@db"

type ScheduledMessageCardProps = {
    row: ScheduledMessageRow
    /** Channel context — non-null for channel messages. */
    channel?: ChannelListItem
    /** The channel's workspace, for the context band. */
    workspace?: WorkspaceFields
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
 * One scheduled message: bordered box with a grey context band (time ·
 * destination · kebab) over the body — ChatInput's reply-banner anatomy. The
 * list's day headers carry the date. Desktop: dropdown menu, Edit swaps the
 * body for the inline editor. Mobile: tapping the row opens an action sheet,
 * Edit opens a sheet hosted by the list. Send now / Delete confirm first.
 */

export const ScheduledMessageCard = ({
    row, channel, workspace, dmChannel, peer, onSendNow, editingRowId, onEditingChange, onRowSaved, onDelete,
}: ScheduledMessageCardProps) => {
    const isMobile = useIsMobile()
    const isFailed = row.status === "Failed"
    const isEditing = row.name === editingRowId
    // Delivery time in the user's 12/24h preference; sun/moon marks day (06–18) vs night.
    const { shortTime } = useMessageTimes(row.scheduled_time)
    const deliveryHour = fromServerDatetime(row.scheduled_time).hour()
    const DayNightIcon = deliveryHour >= 6 && deliveryHour < 18 ? SunIcon : MoonIcon
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

    // One source for the kebab dropdown AND the right-click menu.
    const actions = [
        { icon: SendHorizontalIcon, label: _("Send now"), onClick: () => setSendNowOpen(true) },
        { icon: Edit3Icon, label: _("Edit"), onClick: () => onEditingChange(row.name) },
        { icon: Trash2Icon, label: _("Delete"), onClick: () => setDeleteOpen(true), destructive: true },
    ]

    return (
        <div className="px-2 py-1">
        <ContextMenu>
            {/* Right-click opens the same actions at the cursor (chat-stream parity).
                Mobile keeps its tap sheet; disabled also while editing. */}
            <ContextMenuTrigger asChild disabled={isMobile || isEditing}>
            {/* ChatInput's reply-banner anatomy: bordered box, grey context band
                on top (time · destination · kebab), message body below. */}
            <div
                className={cn(
                    "overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-base text-left select-none",
                    // CSS :active, not state — a Virtuoso-recycled instance can't
                    // highlight the wrong row.
                    "active:border-outline-gray-3",
                    actionsOpen && "border-outline-gray-3",
                )}
                {...rowTapHandlers}
            >
                <div className="flex items-center gap-1.5 bg-surface-gray-1 px-3 py-1.5 text-sm text-ink-gray-6">
                    <DayNightIcon className="size-3.5 shrink-0 text-ink-gray-5" />
                    <span className="shrink-0 tabular-nums">{shortTime}</span>
                    {channel && (
                        <>
                            <span className="shrink-0 text-ink-gray-4">·</span>
                            {workspace && <span className="truncate">{workspace.workspace_name}</span>}
                            <ChannelIcon type={channel.type} className="size-3.5 shrink-0 text-ink-gray-5" />
                            <span className="truncate min-w-0 -ml-0.5">{channel.channel_name}</span>
                        </>
                    )}
                    {dmChannel && (
                        <>
                            <span className="shrink-0 text-ink-gray-4">·</span>
                            <MessageSquareMore className="size-3.5 shrink-0 text-ink-gray-5" />
                            <span className="truncate min-w-0 -ml-0.5">{peerName}</span>
                        </>
                    )}
                    {!isEditing && !isMobile && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    isIconButton
                                    aria-label={_("Scheduled message actions")}
                                    className="ms-auto shrink-0 -me-1.5"
                                >
                                    <EllipsisIcon className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {actions.map(({ icon: Icon, label, onClick, destructive }) => (
                                    <DropdownMenuItem
                                        key={label}
                                        variant={destructive ? "destructive" : undefined}
                                        className="text-base md:text-sm py-2.5 md:py-1.5"
                                        onClick={onClick}
                                    >
                                        <Icon />
                                        {label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
                <div className="px-3 py-2">
                    {isEditing && !isMobile ? (
                        <InlineScheduledMessageEditor
                            row={row}
                            onDone={onRowSaved}
                            onCancel={() => onEditingChange(null)}
                        />
                    ) : (
                        <>
                            {isFailed && (
                                <div className="mb-1 flex flex-col gap-0.5">
                                    <Badge variant="subtle" theme="red" className="self-start">{_("Failed")}</Badge>
                                    {row.error && <p className="whitespace-pre-line text-sm text-ink-red-6">{row.error}</p>}
                                </div>
                            )}
                            <div className="[&_p]:my-0">
                                <MessageBody content={row.text} />
                            </div>
                        </>
                    )}
                </div>
                {!isEditing && (
                    <>
                        {/* Mobile action sheet (row tap). Rows close the sheet first, then
                            open their confirm — AlertDialog over a just-closed sheet is the
                            house pattern. */}
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
            </ContextMenuTrigger>
            <ContextMenuContent>
                {actions.map(({ icon: Icon, label, onClick, destructive }) => (
                    <ContextMenuItem
                        key={label}
                        variant={destructive ? "destructive" : undefined}
                        onClick={onClick}
                    >
                        <Icon />
                        {label}
                    </ContextMenuItem>
                ))}
            </ContextMenuContent>
        </ContextMenu>
        </div>
    )
}
