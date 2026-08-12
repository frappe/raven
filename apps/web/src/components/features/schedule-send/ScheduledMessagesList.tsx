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
 * Virtualized list of the user's pending + failed scheduled messages.
 * Desktop edits inline in the card; mobile edits in a sheet hosted here,
 * outside the virtualizer, so row recycling can't unmount a mid-edit editor.
 */
const ScheduledMessagesList = ({ channel, editingRowId, onEditingChange, onRowSaved, refresh }: ScheduledMessagesListProps) => {
    const { data, error, isLoading } = useFrappeGetCall<{ message: ScheduledMessageRow[] }>(
        "raven.api.scheduled_message.get_scheduled_messages",
        channel === "*all" ? undefined : { channel_id: channel },
        `${SCHEDULED_MESSAGES_KEY}-${channel}`,
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
    // A scheduled message is always the current user's own.
    const { name: currentUser } = useUserCookieData()
    const { usersById, channelById, dmById } = useMessageRowLookups()
    const currentUserData = usersById.get(currentUser)

    // API returns Scheduled + Failed only.
    const rows = data?.message ?? []

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
