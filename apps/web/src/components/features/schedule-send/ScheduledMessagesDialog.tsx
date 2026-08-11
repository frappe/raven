import { useState } from "react"
import { useSWRConfig } from "frappe-react-sdk"
import { XIcon } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { ChannelFilter } from "@components/common/filters/ChannelFilter"
import { useChannelList } from "@stores/channels/useChannelList"
import { useUsers } from "@hooks/useUsers"
import ScheduledMessagesList, { SCHEDULED_MESSAGES_KEY } from "./ScheduledMessagesList"
import _ from "@lib/translate"

type ScheduledMessagesDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Settings-dialog-sized popup for managing scheduled messages, opened from the
 * primary sidebar icon. A single list view; editing happens INLINE on the card
 * (chat-stream pattern), with `editingRowId` held here so it survives the list's
 * virtualization. Closing (Esc / outside click / X) is only allowed when nothing is
 * being edited — while a row is editing, all three cancel the edit instead, so
 * mid-edit state is never discarded.
 */
const ScheduledMessagesDialog = ({ open, onOpenChange }: ScheduledMessagesDialogProps) => {
    const [editingRowId, setEditingRowId] = useState<string | null>(null)
    const [channel, setChannel] = useState("*all")

    const { channels, dmChannels } = useChannelList()
    const users = useUsers()

    // A mutation can land in ANY of the list's per-channel SWR keys
    // (`scheduled-messages-${channel}`), and the current one depends on the filter
    // above — so revalidate every key under the prefix (SWR ≥ 2 supports a matcher).
    // The realtime event also refreshes the list, but this covers the user's own action.
    // The sidebar badge's count key (`scheduled-messages-count`) shares the prefix,
    // so the matcher revalidates it too.
    const { mutate } = useSWRConfig()
    const refreshList = () => {
        mutate((key) => typeof key === "string" && key.startsWith(SCHEDULED_MESSAGES_KEY))
    }

    const cancelEditing = () => setEditingRowId(null)
    const isEditing = editingRowId !== null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                // Desktop: settings-dialog dimensions. Mobile: a full-screen page —
                // the dialog covered nearly the whole viewport anyway, so take it all
                // (undo the base Content's centering, radius and size caps).
                className="min-w-5xl p-0 overflow-y-hidden max-lg:min-w-0 max-lg:w-dvw max-lg:max-w-none max-lg:h-dvh max-lg:max-h-none max-lg:rounded-none max-lg:top-0 max-lg:left-0 max-lg:translate-x-0 max-lg:translate-y-0"
                // The default close X calls onOpenChange(false) directly, bypassing the
                // editing guard below — so it is swapped for a controlled button.
                showCloseButton={false}
                // Esc may close the dialog ONLY when nothing is being edited — while a
                // row is editing it cancels the edit instead (the inline editor's own
                // Escape handling also stops propagation for the same reason).
                onEscapeKeyDown={(e) => {
                    if (isEditing) {
                        e.preventDefault()
                        cancelEditing()
                    }
                }}
                onPointerDownOutside={(e) => {
                    if (isEditing) e.preventDefault()
                }}
            >
                <div className="flex flex-col h-[calc(100vh-8rem)] max-lg:h-dvh">
                    {/* Header band: title only. The close X sits in the dialog's corner
                        (absolute top-4 right-4) exactly like dialog.tsx's built-in close
                        button — ours is controlled because it cancels an active inline
                        edit instead of closing. */}
                    <div className="px-8 pt-6 pb-4 shrink-0">
                        <DialogTitle>{_("Scheduled Messages")}</DialogTitle>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isIconButton
                        aria-label={_("Close")}
                        className="absolute top-4 ltr:right-4 rtl:left-4"
                        onClick={() => {
                            if (isEditing) { cancelEditing() } else { onOpenChange(false) }
                        }}
                    >
                        <XIcon />
                    </Button>
                    <div className="px-8 pb-4 shrink-0">
                        <ChannelFilter
                            channels={channels}
                            dmChannels={dmChannels}
                            users={users}
                            value={channel}
                            onValueChange={setChannel}
                            allLabel={_('Any Channel')}
                            // w-fit: same as the mobile page — a block container would
                            // stretch the flex wrapper full-row and strand the inline
                            // clear button at the panel's right edge.
                            className="w-fit shrink-0"
                            triggerClassName="w-50"
                            modal
                        />
                    </div>
                    {/* px-4: card rows carry px-2 outer + px-2 inner, so their text
                        lands at 32px — flush with the px-8 header band — while the
                        hover pill stays visually inset. */}
                    <div className="flex-1 min-h-0 px-6 pb-6">
                        <ScheduledMessagesList
                            channel={channel}
                            editingRowId={editingRowId}
                            onEditingChange={setEditingRowId}
                            onRowSaved={() => { refreshList(); setEditingRowId(null) }}
                            refresh={refreshList}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default ScheduledMessagesDialog
