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
import { useAtomValue } from "jotai"
import { timeFormatAtom } from "@utils/preferences"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner, { errorResponseToast } from "@components/ui/error-banner"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { MessageResultBlock, RESULT_ROW_ACTIVE_CLASS } from "@components/common/MessageResultBlock/MessageResultBlock"
import { pollPreviewHtml } from "@components/common/MessageResultBlock/pollPreviewHtml"
import type { SelectedNotification } from "@pages/notifications/NotificationChat"
import { useMessageRowLookups } from "@hooks/useMessageRowLookups"
import { Message, BaseMessage } from "@raven/types/common/Message"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { escapeHtml } from "@utils/htmlUtils"
import { getMessageAuthorId } from "@utils/messageUtils"
import { formatDateTimeLabel, fromServerDatetime, getReminderPresets, toServerDatetime } from "@lib/timeUtils"
import { ReminderDialog } from "./ReminderDialog"
import { UNREAD_REMINDER_COUNT_KEY, useRemindersList, type ReminderRow } from "./useReminders"

interface RemindersListProps {
    /** Page-level search (shared across tabs) — matches the note, the message body and its plain content. */
    searchQuery: string
    /** Page-level channel filter ('*all' = no filter). */
    channel: string
    /** In progress = due (fired, unread) + upcoming; Completed = fired and read. */
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

/** The user shown as the reminder message's author: the bot for bot messages. */
const reminderAuthor = (r: ReminderRow) =>
    r.message_owner ? getMessageAuthorId({ is_bot_message: r.message_is_bot, bot: r.message_bot }, r.message_owner) : undefined

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
    // A poll renders as a static question + options block (see pollPreviewHtml).
    if (messageType === "Poll") {
        // poll_id is required by the type but unused here: the block never fetches the live poll.
        return { ...base, message_type: "Poll", text: pollPreviewHtml(r.message_content), poll_id: "" }
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

/** One plain-text line describing the reminder's message, for the delete confirmation. */
const messagePreview = (r: ReminderRow): string => {
    if (r.message_type === "Image") return `📷 ${_("Sent a photo")}`
    if (r.message_type === "File") return `📄 ${r.message_content || (r.message_file ?? "").split("/").pop() || _("Sent a file")}`
    // A poll's content is its question on the first line, then the options.
    if (r.message_type === "Poll") return `📊 ${r.message_content?.split("\n")[0]?.trim() || _("Poll")}`
    // Plain content when the server has it, else the HTML body with its tags stripped.
    const plain = r.message_content || (r.message_text ?? "").replace(/<[^>]+>/g, " ")
    return plain.replace(/\s+/g, " ").trim() || _("Message")
}

/** Later's reminder lists — one card design (Slack Later pattern) across both modes. */
const RemindersList = ({ searchQuery, channel, mode, onSelect, selectedID, selectedReminderID }: RemindersListProps) => {
    const { reminders, error, isLoading, mutate } = useRemindersList()
    const { mutate: globalMutate } = useSWRConfig()
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()
    const timeFormat = useAtomValue(timeFormatAtom)

    // Cards completed this visit stay in Due (restyled as read) instead
    // of jumping to Completed mid-look; cleared on tab switch.
    const [stickyRead, setStickyRead] = useState<Set<string>>(() => new Set())
    useEffect(() => setStickyRead(new Set()), [mode])

    const rows = useMemo<Row[]>(() => {
        const channelParam = channel && channel !== '*all' ? channel : undefined
        const query = searchQuery.trim().toLowerCase()
        const visible = reminders
            .filter((r) => !channelParam || r.channel_id === channelParam)
            // Plain content covers what the HTML body does not: a poll's question and
            // options, and a file's caption.
            .filter((r) =>
                !query ||
                (r.description ?? '').toLowerCase().includes(query) ||
                (r.message_text ?? '').toLowerCase().includes(query) ||
                (r.message_content ?? '').toLowerCase().includes(query))
        if (mode === 'completed') {
            return visible
                .filter((r) => r.notified === 1 && r.is_read === 1)
                .sort((a, b) => b.remind_at.localeCompare(a.remind_at))
                .map((reminder) => ({ kind: "reminder" as const, reminder }))
        }
        const upcoming = visible
            .filter((r) => !r.notified)
            .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
        const due = visible
            .filter((r) => r.notified === 1 && (!r.is_read || stickyRead.has(r.name)))
            .sort((a, b) => b.remind_at.localeCompare(a.remind_at))
        // Due first: those need an action now. Upcoming is a schedule to glance at.
        const out: Row[] = []
        if (due.length) out.push({ kind: "header", label: _("Due") }, ...due.map((reminder) => ({ kind: "reminder" as const, reminder })))
        if (upcoming.length) out.push({ kind: "header", label: _("Upcoming") }, ...upcoming.map((reminder) => ({ kind: "reminder" as const, reminder })))
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
    // The card whose kebab or right-click menu is open. It gets the active row look so
    // it is clear which reminder the menu belongs to.
    const [menuFor, setMenuFor] = useState<string | null>(null)
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
                toast.success(_("Reminder set for {0}", [formatDateTimeLabel(remindAt, timeFormat)]))
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

    /** Opens the message; a due card also completes (open = complete). */
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
    const presets = getReminderPresets(timeFormat)

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
                        label: _("Edit"),
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
                    label: _("Delete"),
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
                                ? _("Reminders you've opened or checked off show here.")
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
                    const authorId = reminderAuthor(reminder)
                    const isUnread = reminder.notified === 1 && !reminder.is_read
                    const menu = cardMenu(reminder)
                    const channelData = channelById.get(reminder.channel_id)
                    const dmChannel = dmById.get(reminder.channel_id)
                    const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                    return (
                        // Desktop: right-click mirrors the kebab. Mobile: long-press sheet
                        // instead — Radix trigger disabled, OS context menu suppressed.
                        <ContextMenu onOpenChange={(next) => setMenuFor(next ? reminder.name : null)}>
                            <ContextMenuTrigger asChild disabled={isMobile}>
                                <div
                                    // group: the kebab is a sibling of the card, not a child, so the card's own
                                    // hover would drop while the pointer is on the button. The card follows the group.
                                    className="group relative"
                                    onPointerDown={startPress(reminder)}
                                    onPointerMove={movePress}
                                    onPointerUp={cancelPress}
                                    onPointerCancel={cancelPress}
                                    onClickCapture={onCardClickCapture}
                                    onContextMenu={(e) => { if (isMobile) e.preventDefault() }}
                                >
                                    <MessageResultBlock
                                        message={reminderRowToMessage(reminder)}
                                        user={authorId ? usersById.get(authorId) : undefined}
                                        channel={channelData}
                                        dmChannel={dmChannel}
                                        peer={peer}
                                        workspace={channelData?.workspace ? workspaceById.get(channelData.workspace) : undefined}
                                        // Two different marks. The card being acted on (menu, sheet, edit or delete
                                        // dialog open) keeps the hover shade so it stays marked. The card whose chat
                                        // is open on the right gets the raised active look, and that wins over the shade.
                                        className={cn(
                                            (menuFor === reminder.name
                                                || sheetTarget?.name === reminder.name
                                                || (editOpen && editTarget?.name === reminder.name)
                                                || (confirmOpen && confirmTarget?.name === reminder.name))
                                            && "bg-surface-gray-3",
                                            activeReminderID === reminder.name
                                                ? RESULT_ROW_ACTIVE_CLASS
                                                : "group-hover:bg-surface-gray-3",
                                        )}
                                        unread={isUnread}
                                        footer={
                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-gray-5">
                                                <AlarmClock className="h-3 w-3 shrink-0" />
                                                {reminder.description && (
                                                    <>
                                                        <span className="truncate font-medium text-ink-gray-7">{reminder.description}</span>
                                                        <span className="shrink-0">·</span>
                                                    </>
                                                )}
                                                <span className="shrink-0">{formatDateTimeLabel(fromServerDatetime(reminder.remind_at), timeFormat)}</span>
                                            </div>
                                        }
                                        onClick={() => open(reminder)}
                                    />
                                    <div
                                        // Shown only while the card is hovered, while its menu is open, or while
                                        // the button has keyboard focus. Opacity rather than display, so the
                                        // button stays in the tab order and nothing shifts when it appears.
                                        className="absolute right-4 top-2 hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <DropdownMenu onOpenChange={(next) => setMenuFor(next ? reminder.name : null)}>
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
                            {/* The message the reminder points at, then the note if there is one. */}
                            <div className="truncate text-p-sm text-ink-gray-8">
                                {messagePreview(confirmTarget)}
                            </div>
                            {confirmTarget.description && (
                                <div className="mt-0.5 truncate text-p-sm text-ink-gray-7">
                                    {confirmTarget.description}
                                </div>
                            )}
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-gray-5">
                                <AlarmClock className="h-3 w-3 shrink-0" />
                                <span className="shrink-0">{formatDateTimeLabel(fromServerDatetime(confirmTarget.remind_at), timeFormat)}</span>
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
