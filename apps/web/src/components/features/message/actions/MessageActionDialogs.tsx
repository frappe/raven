import { useRef } from "react"
import { useAtom } from "jotai"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { messageDialogAtom } from "@utils/channelAtoms"
import { DeleteMessageDialog } from "./dialogs/DeleteMessageDialog"
import { ReactionsDialog } from "./dialogs/ReactionsDialog"
import { AttachToDocumentDialog } from "./dialogs/AttachToDocumentDialog"
import { RunMessageActionDialog, type RunMessageActionTarget } from "./dialogs/RunMessageActionDialog"
import { ReadReceiptsDialog } from "./dialogs/ReadReceiptsDialog"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"

/**
 * Orchestrator for message dialogs: mounted once at the app shell, it reads
 * `messageDialogAtom` and mounts each dialog — so menu items, the hover toolbar,
 * and keyboard shortcuts all open the same instances without per-message mounting.
 *
 * Each real dialog lives in ./dialogs/<Name>.tsx (extracted as its layer lands).
 * Delete, reactions, and attach-to-document are done; edit is inline (see
 * EditMessageComposer, no dialog); forward is still a placeholder inline below.
 */
export const MessageActionDialogs = () => {
    const [dialog, setDialog] = useAtom(messageDialogAtom)
    const close = () => setDialog(null)

    // Render the delete / reactions / attach dialogs from the LAST target so their content
    // stays put through the close animation instead of flashing empty (same trick as the menu).
    const lastDeleteRef = useRef<Message | null>(null)
    if (dialog?.type === "delete") lastDeleteRef.current = dialog.message
    const lastReactionsRef = useRef<Message | null>(null)
    if (dialog?.type === "reactions") lastReactionsRef.current = dialog.message
    const lastAttachRef = useRef<Message | null>(null)
    if (dialog?.type === "attach-document") lastAttachRef.current = dialog.message
    const lastCustomActionRef = useRef<RunMessageActionTarget | null>(null)
    if (dialog?.type === "custom-action") lastCustomActionRef.current = { message: dialog.message, actionID: dialog.actionID }
    const lastReadReceiptsRef = useRef<Message | null>(null)
    if (dialog?.type === "read-receipts") lastReadReceiptsRef.current = dialog.message

    return (
        <>
            <DeleteMessageDialog
                open={dialog?.type === "delete"}
                message={dialog?.type === "delete" ? dialog.message : lastDeleteRef.current}
                onClose={close}
            />

            <ReactionsDialog
                open={dialog?.type === "reactions"}
                message={dialog?.type === "reactions" ? dialog.message : lastReactionsRef.current}
                onClose={close}
            />

            <AttachToDocumentDialog
                open={dialog?.type === "attach-document"}
                message={dialog?.type === "attach-document" ? dialog.message : lastAttachRef.current}
                onClose={close}
            />

            <RunMessageActionDialog
                open={dialog?.type === "custom-action"}
                target={dialog?.type === "custom-action" ? { message: dialog.message, actionID: dialog.actionID } : lastCustomActionRef.current}
                onClose={close}
            />

            <ReadReceiptsDialog
                open={dialog?.type === "read-receipts"}
                message={dialog?.type === "read-receipts" ? dialog.message : lastReadReceiptsRef.current}
                onClose={close}
            />

            <Dialog open={dialog?.type === "forward"} onOpenChange={(open) => !open && close()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{_("Forward message")}</DialogTitle>
                        <DialogDescription>
                            {/* TODO(layer 5): channel/user picker + forward_message API */}
                            {_("Choose where to forward this message.")}
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </>
    )
}
