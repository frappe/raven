import { useContext, useEffect, useRef } from "react"
import { Virtuoso } from "react-virtuoso"
import {
    FrappeConfig, FrappeContext, useFrappeGetCall, useFrappeEventListener,
    useFrappeDeleteDoc,
} from "frappe-react-sdk"
import { CalendarClockIcon } from "lucide-react"
import ErrorBanner, { errorResponseToast } from "@components/ui/error-banner"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@components/ui/empty"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { useMessageRowLookups } from "@hooks/useMessageRowLookups"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useIsMobile } from "@hooks/use-mobile"
import { toast } from "sonner"
import _ from "@lib/translate"
import { EditScheduledMessageSheet } from "./EditScheduledMessageSheet"
import { ScheduledMessageCard } from "./ScheduledMessageCard"

/** A pending (Scheduled) or Failed scheduled-message row from get_scheduled_messages. */
export type ScheduledMessageRow = {
    name: string
    channel_id: string
    text: string
    scheduled_time: string
    status: "Scheduled" | "Failed"
    error?: string
}

/** SWR key prefix for the scheduled-messages list (keyed per channel filter). */
export const SCHEDULED_MESSAGES_KEY = "scheduled-messages"

type ScheduledMessagesListProps = {
    /** Channel filter value; "*all" means no filter. */
    channel: string
    /** Name of the row currently being edited inline (null = none) — lives in the
     *  parent so it survives Virtuoso unmounting rows. */
    editingRowId: string | null
    /** Enter/exit inline-edit mode for a row. */
    onEditingChange: (id: string | null) => void
    /** Called after a successful inline save — the parent refreshes the list and exits edit mode. */
    onRowSaved: () => void
    /** Revalidate every key under SCHEDULED_MESSAGES_KEY (the parent's prefix matcher). */
    refresh: () => void
}

/**
 * The scheduled-messages list: the user's pending + failed scheduled messages as a
 * virtualized list of message cards. Send now + Delete stay internal (behind
 * AlertDialog confirmations); Edit swaps the card's body for the inline editor
 * (chat-stream pattern) via the parent's editingRowId — DESKTOP only. On mobile
 * the editor lives in a bottom sheet (Drawer) hosted here, OUTSIDE the virtualized
 * list, so the Virtuoso-unmount-mid-edit concern disappears on mobile.
 */
const ScheduledMessagesList = ({ channel, editingRowId, onEditingChange, onRowSaved, refresh }: ScheduledMessagesListProps) => {
    const { data, error, isLoading } = useFrappeGetCall<{ message: ScheduledMessageRow[] }>(
        "raven.api.scheduled_message.get_scheduled_messages",
        channel === "*all" ? undefined : { channel_id: channel },
        `${SCHEDULED_MESSAGES_KEY}-${channel}`,
    )
    // A realtime event can land at any moment. Unsaved inline-edit state lives in the
    // ROW component (the InlineScheduledMessageEditor's local date/time/text), so a
    // refetch-driven reflow while editing must NOT unmount that row mid-edit. Defer
    // the refetch until editing ends instead of dropping it. (useFrappeEventListener
    // re-subscribes with a fresh closure each render, so editingRowId is current.)
    const pendingRefetchRef = useRef(false)
    useFrappeEventListener("raven_scheduled_message_updated", () => {
        // Server-side lifecycle signal (created / sent / failed / deleted anywhere).
        if (editingRowId !== null) {
            pendingRefetchRef.current = true
            return
        }
        refresh()
    })

    // Editing ended: flush any realtime refetch that arrived while a row was editing.
    useEffect(() => {
        if (editingRowId === null && pendingRefetchRef.current) {
            pendingRefetchRef.current = false
            refresh()
        }
    }, [editingRowId, refresh])

    const { call } = useContext(FrappeContext) as FrappeConfig
    const { deleteDoc } = useFrappeDeleteDoc()

    const isMobile = useIsMobile()
    // A scheduled message is always the current user's own.
    const { name: currentUser } = useUserCookieData()
    const { usersById, channelById, dmById } = useMessageRowLookups()
    const currentUserData = usersById.get(currentUser)

    // API returns Scheduled + Failed only.
    const rows = data?.message ?? []

    // The row being edited, for the mobile bottom-sheet editor. Guarded: the row
    // can vanish via realtime while the sheet is open — if it does, the sheet
    // simply unmounts (closes) instead of rendering against a dead row.
    const editingRow = rows.find((row) => row.name === editingRowId)

    const sendNow = (row: ScheduledMessageRow) => {
        call.post("raven.api.scheduled_message.send_now", { name: row.name })
            .then(() => {
                toast.success(_("Message sent"))
                refresh()
            })
            .catch((e) => errorResponseToast(_("Could not send message"), e))
    }

    const deleteMessage = (row: ScheduledMessageRow) => {
        deleteDoc("Raven Scheduled Message", row.name)
            .then(() => {
                toast.success(_("Message deleted"))
                refresh()
            })
            .catch((e) => errorResponseToast(_("Could not delete message"), e))
    }

    if (error) return <ErrorBanner error={error} />
    if (isLoading) return <MessageListSkeleton />
    if (rows.length === 0) {
        // Absolute overlay centred on the dialog body — same empty-state anatomy as saved / notifications / threads.
        return (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Empty>
                    <EmptyMedia><CalendarClockIcon /></EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>{_("No scheduled messages")}</EmptyTitle>
                        <EmptyDescription>{_("Schedule a message from any channel's send menu.")}</EmptyDescription>
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
            increaseViewportBy={{ top: 600, bottom: 600 }}
            computeItemKey={(_idx, row) => row?.name ?? _idx}
            itemContent={(_idx, row) => {
                if (!row) return null
                const channelData = channelById.get(row.channel_id)
                const dmChannel = dmById.get(row.channel_id)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <ScheduledMessageCard
                        row={row}
                        user={currentUserData}
                        channel={channelData}
                        dmChannel={dmChannel}
                        peer={peer}
                        onSendNow={sendNow}
                        editingRowId={editingRowId}
                        onEditingChange={onEditingChange}
                        onRowSaved={onRowSaved}
                        onDelete={deleteMessage}
                    />
                )
            }}
        />
        {/* Mobile-only edit sheet: the editor lives OUTSIDE the virtualized list,
            so the Virtuoso-unmount-mid-edit concern disappears on mobile (the
            editor is no longer a recycled row's child). The sheet's dismiss
            (drag down / overlay tap) maps to cancelling the edit. */}
        {isMobile && editingRow && (
            <EditScheduledMessageSheet
                row={editingRow}
                open
                onOpenChange={(open) => { if (!open) onEditingChange(null) }}
                onDone={onRowSaved}
            />
        )}
        </>
    )
}

export default ScheduledMessagesList
