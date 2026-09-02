import { useContext, useEffect, useMemo, useRef } from "react"
import { Virtuoso } from "react-virtuoso"
import {
    FrappeConfig, FrappeContext, useFrappeGetCall, useFrappeEventListener,
    useFrappeDeleteDoc,
} from "frappe-react-sdk"
import dayjs, { Dayjs } from "dayjs"
import { CalendarClockIcon } from "lucide-react"
import ErrorBanner, { errorResponseToast } from "@components/ui/error-banner"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@components/ui/empty"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { useMessageRowLookups } from "@hooks/useMessageRowLookups"
import { useIsMobile } from "@hooks/use-mobile"
import { fromServerDatetime } from "@lib/timeUtils"
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

/** SWR key prefix shared by the list and the count badge. */
export const SCHEDULED_MESSAGES_KEY = "scheduled-messages"

/** Day-group header for a delivery time; the card itself shows only the time. */
const groupLabel = (time: Dayjs, now: Dayjs) => {
    if (time.isSame(now, "day")) return _("Today")
    if (time.isSame(now.add(1, "day"), "day")) return _("Tomorrow")
    return time.format(time.year() === now.year() ? "ddd, MMM D" : "ddd, MMM D, YYYY")
}

type ListItem =
    | { type: "header", label: string }
    | { type: "row", row: ScheduledMessageRow }

type ScheduledMessagesListProps = {
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
 * Virtualized list of the user's pending + failed scheduled messages, grouped
 * by delivery day (Today / Tomorrow / date). Desktop edits inline in the card;
 * mobile edits in a sheet hosted here, outside the virtualizer, so row
 * recycling can't unmount a mid-edit editor.
 */
const ScheduledMessagesList = ({ editingRowId, onEditingChange, onRowSaved, refresh }: ScheduledMessagesListProps) => {
    const { data, error, isLoading } = useFrappeGetCall<{ message: ScheduledMessageRow[] }>(
        "raven.api.scheduled_message.get_scheduled_messages",
        undefined,
        `${SCHEDULED_MESSAGES_KEY}-list`,
    )
    // A refetch-driven reflow would unmount a mid-edit row (its unsaved state
    // lives there) — defer realtime refetches until editing ends.
    const pendingRefetchRef = useRef(false)
    useFrappeEventListener("raven_scheduled_message_updated", () => {
        if (editingRowId !== null) {
            pendingRefetchRef.current = true
            return
        }
        refresh()
    })

    // Flush the deferred refetch once editing ends.
    useEffect(() => {
        if (editingRowId === null && pendingRefetchRef.current) {
            pendingRefetchRef.current = false
            refresh()
        }
    }, [editingRowId, refresh])

    const { call } = useContext(FrappeContext) as FrappeConfig
    const { deleteDoc } = useFrappeDeleteDoc()

    const isMobile = useIsMobile()
    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    // API returns Scheduled + Failed only, ordered by scheduled_time — so a
    // single pass emits a header wherever the day changes.
    const rows = data?.message ?? []
    const items = useMemo(() => {
        const now = dayjs()
        const out: ListItem[] = []
        let lastLabel: string | null = null
        for (const row of rows) {
            const label = groupLabel(fromServerDatetime(row.scheduled_time), now)
            if (label !== lastLabel) {
                out.push({ type: "header", label })
                lastLabel = label
            }
            out.push({ type: "row", row })
        }
        return out
    }, [data])

    // Can vanish via realtime while the sheet is open — the sheet then unmounts.
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
            data={items}
            style={{ height: '100%' }}
            initialItemCount={Math.min(items.length, 10)}
            increaseViewportBy={{ top: 600, bottom: 600 }}
            computeItemKey={(_idx, item) =>
                item ? (item.type === "header" ? `header-${item.label}` : item.row.name) : _idx}
            itemContent={(_idx, item) => {
                if (!item) return null
                if (item.type === "header") {
                    // px-5 lines the label up with card content (px-2 wrapper + border + px-3).
                    return (
                        <div className="px-5 pt-3 pb-1 text-sm font-medium text-ink-gray-5">
                            {item.label}
                        </div>
                    )
                }
                const { row } = item
                const channelData = channelById.get(row.channel_id)
                const dmChannel = dmById.get(row.channel_id)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <ScheduledMessageCard
                        row={row}
                        channel={channelData}
                        workspace={channelData?.workspace ? workspaceById.get(channelData.workspace) : undefined}
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
        {/* Outside the virtualizer so row recycling can't unmount a mid-edit editor. */}
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
