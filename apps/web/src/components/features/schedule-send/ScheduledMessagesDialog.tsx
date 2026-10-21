import { useAtom } from "jotai"
import { useSWRConfig } from "frappe-react-sdk"

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog"
import ScheduledMessagesList, { SCHEDULED_MESSAGES_KEY } from "./ScheduledMessagesList"
import { scheduledMessageEditingAtom } from "./useScheduledMessages"
import _ from "@lib/translate"

type ScheduledMessagesDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Desktop dialog for managing scheduled messages, opened from the sidebar icon and
 * the composer banner. Mobile uses the scheduled messages page instead. While a row
 * is being edited, any close request (Esc, outside click, the X) cancels the edit
 * and keeps the dialog open, so unsaved text is never lost to a stray key.
 */
const ScheduledMessagesDialog = ({ open, onOpenChange }: ScheduledMessagesDialogProps) => {
    const [editingRowId, setEditingRowId] = useAtom(scheduledMessageEditingAtom)

    // Prefix mutate after the user's own actions. The list is the one fetch behind the
    // badge and the composer banners too, so this refreshes all of them.
    const { mutate } = useSWRConfig()
    const refreshList = () => {
        mutate((key) => typeof key === "string" && key.startsWith(SCHEDULED_MESSAGES_KEY))
    }

    // One guard for every way of closing. Radix routes Esc, outside clicks and the
    // built-in X through this callback, so no per-event overrides are needed.
    const handleOpenChange = (next: boolean) => {
        if (!next && editingRowId !== null) {
            setEditingRowId(null)
            return
        }
        onOpenChange(next)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {/* Fixed height: the list is virtualized and needs a definite height to scroll
                inside. Same height as the settings dialog. */}
            <DialogContent className="sm:max-w-3xl h-[calc(100vh-8rem)]">
                <DialogHeader>
                    <DialogTitle>{_("Scheduled Messages")}</DialogTitle>
                    <DialogDescription>{_("Messages you've scheduled to send later.")}</DialogDescription>
                </DialogHeader>
                {/* relative: the list's empty state is an absolute overlay centred on the body. */}
                <DialogBody className="relative">
                    <ScheduledMessagesList
                        editingRowId={editingRowId}
                        onEditingChange={setEditingRowId}
                        onRowSaved={() => { refreshList(); setEditingRowId(null) }}
                        refresh={refreshList}
                    />
                </DialogBody>
            </DialogContent>
        </Dialog>
    )
}

export default ScheduledMessagesDialog
