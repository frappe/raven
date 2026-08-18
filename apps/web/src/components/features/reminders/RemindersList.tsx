import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { Virtuoso } from "react-virtuoso"
import { FrappeConfig, FrappeContext, useSWRConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import { AlarmClock, Clock, EllipsisVerticalIcon, Pencil, Trash2 } from "lucide-react"

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "@components/ui/context-menu"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { useIsMobile } from "@hooks/use-mobile"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner, { errorResponseToast } from "@components/ui/error-banner"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { MessageResultBlock, RESULT_ROW_ACTIVE_CLASS } from "@components/common/MessageResultBlock/MessageResultBlock"
import type { SelectedNotification } from "@pages/notifications/NotificationChat"
import { useMessageRowLookups } from "@hooks/useMessageRowLookups"
import { Message, BaseMessage } from "@raven/types/common/Message"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { escapeHtml } from "@utils/htmlUtils"
import { formatDateTimeLabel, fromServerDatetime, getReminderPresets, toServerDatetime } from "@lib/timeUtils"
import { ReminderDialog } from "./ReminderDialog"
import { UNREAD_REMINDER_COUNT_KEY, useRemindersList, type ReminderRow } from "./useReminders"

interface RemindersListProps {
    /** Page-level search (shared across tabs) — matches note + message text. */
    searchQuery: string
    /** Page-level channel filter ('*all' = no filter). */
    channel: string
    /** In progress = upcoming + delivered-unread; Completed = delivered-read. */
    mode: 'in-progress' | 'completed'
    /** Opens the card's message; the reminder id rides along as `?r=`. */
    onSelect: (selection: SelectedNotification, reminderID?: string) => void
    /** Open message id — the active-card fallback when no reminder id is in the URL. */
    selectedID?: string
    /** Open reminder id (from `?r=`) — the precise active card. */
    selectedReminderID?: string
}

/** Flattened virtual rows: section headers only in In progress mode. */
type Row =
    | { kind: "header"; label: string }
    | { kind: "reminder"; reminder: ReminderRow }

/** Map a reminder's message preview fields to a Message for MessageResultBlock. */
function reminderRowToMessage(r: ReminderRow): Message {
    const messageType = (r.message_type ?? "Text") as BaseMessage["message_type"]
    const base: BaseMessage = {
        name: r.message,
        owner: r.message_owner ?? "",
        _liked_by: "[]",
        channel_id: r.channel_id,
        creation: r.message_creation ?? r.remind_at,
        modified: r.message_creation ?? r.remind_at,
        message_type: messageType,
        is_continuation: 0,
        is_reply: 0,
        is_edited: 0,
        is_forwarded: 0,
        is_thread: 0,
        is_pinned: 0,
    }
    // Media becomes a text placeholder — a real image block would dominate the list.
    if (messageType === "Image") {
        return { ...base, message_type: "Text", text: r.message_text || `<p>📷 ${_("Sent a photo")}</p>` }
    }
    if (messageType === "File") {
        const fileName = escapeHtml((r.message_file ?? "").split("/").pop() ?? "")
        return { ...base, message_type: "Text", text: r.message_text || `<p>📄 ${fileName || _("Sent a file")}</p>` }
    }
    return { ...base, message_type: "Text", text: r.message_text ?? "" }
}

/** Later's reminder lists — one card design (Slack Later pattern) across both modes. */
const RemindersList = ({ searchQuery, channel, mode, onSelect, selectedID, selectedReminderID }: RemindersListProps) => {
    const { reminders, error, isLoading, mutate } = useRemindersList()
    const { mutate: globalMutate } = useSWRConfig()
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    // Cards completed by opening them THIS visit. They stay in the Delivered
    // section (restyled as read) instead of jumping to Completed mid-look —
    // the notifications-page pattern. Cleared on tab switch, so the next visit
    // shows them where they now belong.
    const [stickyRead, setStickyRead] = useState<Set<string>>(() => new Set())
    useEffect(() => setStickyRead(new Set()), [mode])

    const rows = useMemo<Row[]>(() => {
        const channelParam = channel && channel !== '*all' ? channel : undefined
        const query = searchQuery.trim().toLowerCase()
        const visible = reminders
            .filter((r) => !channelParam || r.channel_id === channelParam)
            .filter((r) =>
                !query ||
                (r.description ?? '').toLowerCase().includes(query) ||
                (r.message_text ?? '').toLowerCase().includes(query))
        if (mode === 'completed') {
            return visible
                .filter((r) => r.notified === 1 && r.is_read === 1)
                .sort((a, b) => b.remind_at.localeCompare(a.remind_at))
                .map((reminder) => ({ kind: "reminder" as const, reminder }))
        }
        const upcoming = visible
            .filter((r) => !r.notified)
            .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
        const delivered = visible
            .filter((r) => r.notified === 1 && (!r.is_read || stickyRead.has(r.name)))
            .sort((a, b) => b.remind_at.localeCompare(a.remind_at))
        const out: Row[] = []
        if (upcoming.length) out.push({ kind: "header", label: _("Upcoming") }, ...upcoming.map((reminder) => ({ kind: "reminder" as const, reminder })))
        if (delivered.length) out.push({ kind: "header", label: _("Delivered") }, ...delivered.map((reminder) => ({ kind: "reminder" as const, reminder })))
        return out
    }, [reminders, searchQuery, channel, mode, stickyRead])

    // `?r=` when present; else first row on the open message (push links carry no `?r=`).
    const activeReminderID = useMemo(() => {
        if (selectedReminderID) return selectedReminderID
        if (!selectedID) return undefined
        for (const row of rows) {
            if (row.kind === "reminder" && row.reminder.message === selectedID) return row.reminder.name
        }
        return undefined
    }, [rows, selectedID, selectedReminderID])

    // Targets survive close (open flips alone) so dialogs don't flash mid-animation.
    const [confirmTarget, setConfirmTarget] = useState<ReminderRow | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<ReminderRow | null>(null)
    const [editOpen, setEditOpen] = useState(false)

    // Mobile long-press → action sheet; same detector constants as the message stream.
    const isMobile = useIsMobile()
    const [sheetTarget, setSheetTarget] = useState<ReminderRow | null>(null)
    const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null)
    /** Swallow the post-long-press synthetic click, else the chat also opens. */
    const suppressClicksUntilRef = useRef(0)

    const cancelPress = () => {
        if (!pressRef.current) return
        window.clearTimeout(pressRef.current.timer)
        pressRef.current = null
    }

    const startPress = (reminder: ReminderRow) => (event: React.PointerEvent) => {
        if (!isMobile || event.pointerType !== "touch") return
        cancelPress()
        const timer = window.setTimeout(() => {
            pressRef.current = null
            suppressClicksUntilRef.current = performance.now() + 200
            setSheetTarget(reminder)
        }, 450)
        pressRef.current = { timer, x: event.clientX, y: event.clientY }
    }

    const movePress = (event: React.PointerEvent) => {
        const press = pressRef.current
        if (press && (Math.abs(event.clientX - press.x) > 10 || Math.abs(event.clientY - press.y) > 10)) {
            cancelPress()
        }
    }

    const onCardClickCapture = (event: React.MouseEvent) => {
        if (performance.now() > suppressClicksUntilRef.current) return
        suppressClicksUntilRef.current = 0
        event.preventDefault()
        event.stopPropagation()
    }

    /** Run a sheet action and dismiss the sheet. */
    const fromSheet = (action: () => void) => () => {
        setSheetTarget(null)
        action()
    }

    const remove = (reminder: ReminderRow) => {
        // Optimistic; failure re-syncs.
        mutate((prev) => prev && { message: prev.message.filter((r) => r.name !== reminder.name) }, { revalidate: false })
        call.post("raven.api.reminders.delete_reminder", { reminder: reminder.name })
            .then(() => {
                toast.success(_("Reminder deleted"))
                globalMutate(UNREAD_REMINDER_COUNT_KEY)
            })
            .catch((e) => {
                mutate()
                errorResponseToast(_("Could not delete the reminder"), e)
            })
    }

    const snooze = (reminder: ReminderRow, remindAt: ReturnType<typeof fromServerDatetime>) => {
        call.post("raven.api.reminders.snooze_reminder", {
            reminder: reminder.name,
            remind_at: toServerDatetime(remindAt),
        })
            .then(() => {
                toast.success(_("Reminder set for {0}", [formatDateTimeLabel(remindAt)]))
                mutate()
                globalMutate(UNREAD_REMINDER_COUNT_KEY)
            })
            .catch((e) => errorResponseToast(_("Could not snooze the reminder"), e))
    }

    /** Completes ALL fired reminders on the message — the server API is message-keyed. */
    const complete = (reminder: ReminderRow) => {
        if (reminder.is_read) return
        // Pin the affected cards in place before the read flags flip (see stickyRead).
        const affected = reminders.filter((r) => r.message === reminder.message && r.notified && !r.is_read)
        setStickyRead((prev) => new Set([...prev, ...affected.map((r) => r.name)]))
        mutate(
            (prev) => prev && {
                message: prev.message.map((r) => (r.message === reminder.message && r.notified ? { ...r, is_read: 1 as const } : r)),
            },
            { revalidate: false },
        )
        // Failure just re-syncs — not worth a toast.
        call.post("raven.api.reminders.mark_reminder_read", { message_id: reminder.message })
            .then(() => globalMutate(UNREAD_REMINDER_COUNT_KEY))
            .catch(() => mutate())
    }

    /** Opens the message; a delivered card also completes (open = complete). */
    const open = (reminder: ReminderRow) => {
        if (reminder.notified === 1) complete(reminder)
        const channelData = channelById.get(reminder.channel_id)
        const dmChannel = dmById.get(reminder.channel_id)
        const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
        onSelect({
            channelID: reminder.channel_id,
            messageID: reminder.message,
            isDirectMessage: !!dmChannel,
            peer,
            // Unknown-to-the-store channel = thread channel; the pane takes it as thread id.
            isThread: !channelData && !dmChannel,
        }, reminder.name)
    }

    /** Channel context line: channel name, or the DM peer's name. */
    const channelLabel = (reminder: ReminderRow) => {
        const dm = dmById.get(reminder.channel_id)
        if (dm) return usersById.get(dm.peer_user_id)?.full_name ?? dm.peer_user_id
        return channelById.get(reminder.channel_id)?.channel_name ?? _("thread")
    }

    // One preset list per render pass.
    const presets = getReminderPresets()

    /** One menu spec for kebab, right-click and mobile sheet. Remind-again is
     *  post-delivery only; Edit is upcoming-only (changing a future time is an edit). */
    const cardMenu = (reminder: ReminderRow) => {
        const isUpcoming = !reminder.notified
        return {
            remindAgain: isUpcoming
                ? undefined
                : presets.map((preset) => ({
                    id: preset.id,
                    label: preset.label,
                    onSelect: () => snooze(reminder, preset.time),
                })),
            actions: [
                ...(isUpcoming
                    ? [{
                        id: "edit",
                        label: _("Edit reminder"),
                        icon: Pencil,
                        danger: false,
                        onSelect: () => {
                            setEditTarget(reminder)
                            setEditOpen(true)
                        },
                    }]
                    : []),
                {
                    id: "delete",
                    label: _("Delete reminder"),
                    icon: Trash2,
                    danger: true,
                    onSelect: () => {
                        setConfirmTarget(reminder)
                        setConfirmOpen(true)
                    },
                },
            ],
        }
    }

    if (error) return <ErrorBanner error={error} />
    if (isLoading) return <MessageListSkeleton />
    if (rows.length === 0) {
        return (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Empty>
                    <EmptyMedia><AlarmClock /></EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>{mode === 'completed' ? _('No completed reminders') : _('Nothing in progress')}</EmptyTitle>
                        <EmptyDescription>
                            {mode === 'completed'
                                ? _("Reminders you've opened or checked off land here.")
                                : _("Set a reminder from a message's actions — Remind me — or adjust your search.")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        )
    }

    return (
        <>
        <Virtuoso
            data={rows}
            style={{ height: '100%' }}
            initialItemCount={Math.min(rows.length, 10)}
            computeItemKey={(idx, row) => (row?.kind === "header" ? row.label : row?.reminder.name) ?? idx}
            itemContent={(_idx, row) => {
                if (!row) return null
                if (row.kind === "header") {
                    return (
                        <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                            {row.label}
                        </div>
                    )
                }
                const { reminder } = row
                const isUnread = reminder.notified === 1 && !reminder.is_read
                const menu = cardMenu(reminder)
                const channelData = channelById.get(reminder.channel_id)
                const dmChannel = dmById.get(reminder.channel_id)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    // Desktop: right-click mirrors the kebab. Mobile: long-press sheet
                    // instead — Radix trigger disabled, OS context menu suppressed.
                    <ContextMenu>
                    <ContextMenuTrigger asChild disabled={isMobile}>
                    <div
                        className="relative"
                        onPointerDown={startPress(reminder)}
                        onPointerMove={movePress}
                        onPointerUp={cancelPress}
                        onPointerCancel={cancelPress}
                        onClickCapture={onCardClickCapture}
                        onContextMenu={(e) => { if (isMobile) e.preventDefault() }}
                    >
                        <MessageResultBlock
                            message={reminderRowToMessage(reminder)}
                            user={reminder.message_owner ? usersById.get(reminder.message_owner) : undefined}
                            channel={channelData}
                            dmChannel={dmChannel}
                            peer={peer}
                            workspace={channelData?.workspace ? workspaceById.get(channelData.workspace) : undefined}
                            className={activeReminderID === reminder.name ? RESULT_ROW_ACTIVE_CLASS : undefined}
                            unread={isUnread}
                            footer={
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-gray-5">
                                    <AlarmClock className="h-3 w-3 shrink-0" />
                                    {reminder.description && (
                                        <>
                                            <span className="truncate font-medium text-ink-gray-7">{reminder.description}</span>
                                            <span className="shrink-0">·</span>
                                        </>
                                    )}
                                    <span className="shrink-0">{formatDateTimeLabel(fromServerDatetime(reminder.remind_at))}</span>
                                </div>
                            }
                            onClick={() => open(reminder)}
                        />
                        <div
                            className="absolute right-4 top-2 hidden md:flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" isIconButton aria-label={_("More actions")} title={_("More actions")}>
                                        <EllipsisVerticalIcon className="size-5 md:size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {menu.remindAgain && (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <Clock />
                                                {_("Remind me again")}
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent>
                                                {menu.remindAgain.map((preset) => (
                                                    <DropdownMenuItem key={preset.id} onSelect={preset.onSelect}>
                                                        {preset.label}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    )}
                                    {menu.actions.map((action) => (
                                        <DropdownMenuItem
                                            key={action.id}
                                            variant={action.danger ? "destructive" : "default"}
                                            onSelect={action.onSelect}
                                        >
                                            <action.icon />
                                            {action.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    </ContextMenuTrigger>
                    {/* Desktop right-click: same cardMenu spec as the kebab. */}
                    <ContextMenuContent>
                        {menu.remindAgain && (
                            <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                    <Clock />
                                    {_("Remind me again")}
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                    {menu.remindAgain.map((preset) => (
                                        <ContextMenuItem key={preset.id} onSelect={preset.onSelect}>
                                            {preset.label}
                                        </ContextMenuItem>
                                    ))}
                                </ContextMenuSubContent>
                            </ContextMenuSub>
                        )}
                        {menu.actions.map((action) => (
                            <ContextMenuItem
                                key={action.id}
                                variant={action.danger ? "destructive" : "default"}
                                onSelect={action.onSelect}
                            >
                                <action.icon />
                                {action.label}
                            </ContextMenuItem>
                        ))}
                    </ContextMenuContent>
                    </ContextMenu>
                )
            }}
        />

        {/* Mobile action sheet — long-press target; flat rows from the same cardMenu spec. */}
        <Drawer open={!!sheetTarget} onOpenChange={(next) => !next && setSheetTarget(null)}>
            <DrawerContent>
                <DrawerTitle className="sr-only">{_("Reminder actions")}</DrawerTitle>
                <DrawerDescription className="sr-only">{_("Actions for this reminder")}</DrawerDescription>
                <div className="flex flex-col gap-1 p-3 pb-6">
                    {sheetTarget && (() => {
                        const menu = cardMenu(sheetTarget)
                        return (
                            <>
                                {menu.remindAgain && (
                                    <>
                                        <span className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                                            {_("Remind me again")}
                                        </span>
                                        {menu.remindAgain.map((preset) => (
                                            <Button
                                                key={preset.id}
                                                variant="ghost"
                                                size="lg"
                                                className="w-full justify-start gap-3 active:bg-surface-gray-2"
                                                onClick={fromSheet(preset.onSelect)}
                                            >
                                                <Clock />
                                                {preset.label}
                                            </Button>
                                        ))}
                                        <div className="my-1 border-t border-outline-gray-2" />
                                    </>
                                )}
                                {menu.actions.map((action) => (
                                    <Button
                                        key={action.id}
                                        variant="ghost"
                                        size="lg"
                                        theme={action.danger ? "red" : "gray"}
                                        className={cn("w-full justify-start gap-3", action.danger ? "active:bg-surface-red-2" : "active:bg-surface-gray-2")}
                                        onClick={fromSheet(action.onSelect)}
                                    >
                                        <action.icon />
                                        {action.label}
                                    </Button>
                                ))}
                            </>
                        )
                    })()}
                </div>
            </DrawerContent>
        </Drawer>

        <ReminderDialog
            open={editOpen}
            message={null}
            editing={editTarget ?? undefined}
            onClose={() => setEditOpen(false)}
            onSaved={() => mutate()}
        />

        <AlertDialog open={confirmOpen} onOpenChange={(next) => !next && setConfirmOpen(false)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{_("Delete reminder?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {_("You won't be reminded about this message. This can't be undone.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {confirmTarget && (
                    <div className="rounded border border-outline-gray-2 px-2.5 py-2">
                        <div className="truncate text-content text-ink-gray-8">
                            {confirmTarget.description || _("Reminder")}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-gray-5">
                            <AlarmClock className="h-3 w-3 shrink-0" />
                            <span className="shrink-0">{formatDateTimeLabel(fromServerDatetime(confirmTarget.remind_at))}</span>
                            <span className="shrink-0">·</span>
                            <span className="truncate">{channelLabel(confirmTarget)}</span>
                        </div>
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>{_("Cancel")}</AlertDialogCancel>
                    <Button
                        variant="solid"
                        theme="red"
                        size="md"
                        onClick={() => {
                            if (confirmTarget) remove(confirmTarget)
                            setConfirmOpen(false)
                        }}
                    >
                        {_("Delete")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}

export default RemindersList
