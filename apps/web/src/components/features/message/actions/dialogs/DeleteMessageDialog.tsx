import { useEffect, useMemo, useState } from "react"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
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
import { Checkbox } from "@components/ui/checkbox"
import { channelMessagesStore } from "@stores/messages/store"
import { getErrorMessage } from "@lib/frappe"
import { MessagePreview } from "./MessagePreview"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { errorResponseToast } from "@components/ui/error-banner"

/**
 * Delete confirmation with a preview of exactly what's being removed. A single
 * message shows one preview card; a batch (multi-file upload) shows a checklist —
 * all selected by default — since each file is its own Raven Message. Deletes
 * optimistically (instant removal via the store), then calls the bulk API; a
 * failure re-fetches the window to restore truth.
 *
 * Mounted once by MessageActionDialogs and driven by messageDialogAtom; stays
 * mounted (open toggles) so it animates closed, with `message` held from the last
 * target so the body doesn't flash empty mid-animation.
 */
export const DeleteMessageDialog = ({
    open,
    message,
    onClose,
}: {
    open: boolean
    message: Message | null
    onClose: () => void
}) => {
    const { call: deleteMessages } = useFrappePostCall("raven.api.raven_message.delete_messages")

    // A batch's loaded members (oldest-first); empty for a standalone message.
    const members = useMemo(
        () => (message?.message_batch_id ? channelMessagesStore.batchMembers(message.channel_id, message.message_batch_id) : []),
        [message?.name, message?.message_batch_id, message?.channel_id],
    )
    const isBatch = members.length > 1

    // Selected ids — reset to "all" whenever the target changes (dialog stays mounted
    // for the open/close animation, so this can't live in useState initialisation).
    const [selected, setSelected] = useState<Set<string>>(new Set())
    useEffect(() => {
        if (!message) return
        setSelected(new Set(isBatch ? members.map((m) => m.name) : [message.name]))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message?.name])

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const onConfirm = () => {
        if (!message) return
        const ids = [...selected]
        if (ids.length === 0) return
        const channelID = message.channel_id
        // Snapshot the exact message objects first so a failed delete can put them back
        // verbatim, at their original position — without a window refetch that would snap
        // the user to the latest page (and might not even contain a deleted OLD message).
        const state = channelMessagesStore.getState(channelID)
        const snapshot = ids.map((id) => state.byId.get(id)).filter((m): m is Message => !!m)
        // Optimistic: drop them now and close. The realtime echo repeats this (idempotent).
        ids.forEach((id) => channelMessagesStore.messageDeleted(channelID, id))
        onClose()
        deleteMessages({ message_ids: ids }).catch((e) => {
            errorResponseToast(_("Could not delete message"), e)
            // The server didn't delete (so there's no realtime echo) — restore what we removed.
            channelMessagesStore.messagesRestored(channelID, snapshot)
        })
    }

    return (
        <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{isBatch ? _("Delete attachments?") : _("Delete message?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isBatch
                            ? _("Select what to delete. This can't be undone.")
                            : _("This will be removed for everyone in the conversation. This can't be undone.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {message &&
                    (isBatch ? (
                        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                            {members.map((member) => (
                                <label
                                    key={member.name}
                                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-gray-2"
                                >
                                    <Checkbox checked={selected.has(member.name)} onCheckedChange={() => toggle(member.name)} />
                                    <MessagePreview message={member} />
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded overflow-hidden border border-outline-gray-2 px-2.5 py-2">
                            <MessagePreview message={message} />
                        </div>
                    ))}

                <AlertDialogFooter>
                    <AlertDialogCancel>{_("Cancel")}</AlertDialogCancel>
                    <Button
                        variant="solid"
                        theme="red"
                        size="md"
                        disabled={selected.size === 0}
                        onClick={onConfirm}
                    >
                        {isBatch && selected.size > 0 ? _("Delete ({0})", [`${selected.size}`]) : _("Delete")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
