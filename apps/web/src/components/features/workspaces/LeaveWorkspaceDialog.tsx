import { useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { useLeaveWorkspace } from "@hooks/useWorkspaceMembership"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import _ from "@lib/translate"

/**
 * Confirms leaving a workspace; open while `workspace` is set. Render it outside any menu that
 * opened it, since the menu unmounts as it closes. `onLeft` runs once the lists have refetched.
 */
export const LeaveWorkspaceDialog = ({ workspace, onClose, onLeft }: {
    workspace: WorkspaceFields | null
    onClose: () => void
    onLeft?: (workspace: WorkspaceFields) => void
}) => {
    const leaveWorkspace = useLeaveWorkspace()
    const [leaving, setLeaving] = useState(false)
    // The last workspace asked about: the dialog keeps its text while it animates closed.
    const [shown, setShown] = useState(workspace)
    if (workspace && workspace !== shown) setShown(workspace)
    // Anyone may join a public workspace again; any other needs someone to add them back.
    const canRejoin = shown?.type === "Public" && !shown.can_only_join_via_invite

    const leave = (event: React.MouseEvent) => {
        // Stay open while leaving, so a failure keeps the dialog for another try.
        event.preventDefault()
        if (!workspace) return
        setLeaving(true)
        leaveWorkspace(workspace)
            .then(() => {
                onClose()
                onLeft?.(workspace)
            })
            .catch(() => { })
            .finally(() => setLeaving(false))
    }

    return (
        <AlertDialog open={workspace !== null} onOpenChange={(open) => { if (!open && !leaving) onClose() }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    {shown && <AlertDialogTitle>{_("Leave {0}?", [shown.workspace_name])}</AlertDialogTitle>}
                    <AlertDialogDescription>
                        {canRejoin
                            ? _("You'll lose access to its channels. You can join it again any time.")
                            : _("You'll lose access to its channels, and someone will need to add you back to rejoin.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={leaving}>{_("Cancel")}</AlertDialogCancel>
                    <AlertDialogAction disabled={leaving} onClick={leave}>
                        {leaving ? _("Leaving…") : _("Leave")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
