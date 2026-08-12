import { useState } from "react"
import { useFrappeDeleteDoc, useFrappePostCall, useSWRConfig } from "frappe-react-sdk"
import { useAtom } from "jotai"
import { toast } from "sonner"
import { EllipsisVertical, PencilIcon, Trash2Icon } from "lucide-react"
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import {
    Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import ErrorBanner from "@components/ui/error-banner"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Spinner } from "@components/ui/spinner"
import { lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import _ from "@lib/translate"

type Props = {
    workspaceID: string
    workspaceName: string
    onDeleted: () => void
    onRenamed: (newID: string) => void
}

const WorkspaceActionMenu = ({ workspaceID, workspaceName, onDeleted, onRenamed }: Props) => {
    const [isRenameOpen, setRenameOpen] = useState(false)
    const [isDeleteOpen, setDeleteOpen] = useState(false)

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" isIconButton aria-label={_("Workspace options")}>
                        <EllipsisVertical />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                        <PencilIcon />
                        {_("Rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                        <Trash2Icon />
                        {_("Delete")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isRenameOpen} onOpenChange={setRenameOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    {isRenameOpen && (
                        <RenameWorkspaceForm
                            workspaceID={workspaceID}
                            workspaceName={workspaceName}
                            onRenamed={(newID) => {
                                setRenameOpen(false)
                                onRenamed(newID)
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    {isDeleteOpen && (
                        <DeleteWorkspaceForm
                            workspaceID={workspaceID}
                            workspaceName={workspaceName}
                            onDeleted={() => {
                                setDeleteOpen(false)
                                onDeleted()
                            }}
                        />
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

const RenameWorkspaceForm = ({
    workspaceID, workspaceName, onRenamed,
}: { workspaceID: string; workspaceName: string; onRenamed: (newID: string) => void }) => {
    const [name, setName] = useState(workspaceName)
    const { mutate: globalMutate } = useSWRConfig()
    const [lastWorkspace, setLastWorkspace] = useAtom(lastWorkspaceAtom)
    const { call, loading, error } = useFrappePostCall("frappe.model.rename_doc.update_document_title")

    const handleSubmit = () => {
        call({ doctype: "Raven Workspace", docname: workspaceID, name, merge: 0 }).then((res) => {
            toast.success(_("Workspace renamed"))
            globalMutate("workspaces_list")
            // Renaming cascades the new name into every channel's `workspace`
            // link server-side — without refetching the channel list, the
            // renamed workspace's sidebar shows no channels (they still carry
            // the old name client-side) until some later revalidation.
            globalMutate("channel_list")
            if (lastWorkspace === workspaceID) {
                setLastWorkspace(res.message)
            }
            onRenamed(res.message)
        })
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>{_("Rename Workspace")}</DialogTitle>
            </DialogHeader>
            {error && <ErrorBanner error={error} />}
            <div className="flex flex-col gap-2">
                <Label htmlFor="rename-workspace">{_("Select a new name for your workspace")}</Label>
                <Input id="rename-workspace" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button size="md" type="button" variant="outline" disabled={loading}>{_("Close")}</Button>
                </DialogClose>
                <Button size="md" type="button" disabled={loading || !name} onClick={handleSubmit}>
                    {loading && <Spinner />}
                    {loading ? _("Renaming...") : _("Rename")}
                </Button>
            </DialogFooter>
        </>
    )
}

const DeleteWorkspaceForm = ({
    workspaceID, workspaceName, onDeleted,
}: { workspaceID: string; workspaceName: string; onDeleted: () => void }) => {
    const { mutate: globalMutate } = useSWRConfig()
    const { deleteDoc, error, loading } = useFrappeDeleteDoc()
    const [typedName, setTypedName] = useState("")
    const isNameTyped = typedName === workspaceName

    const handleDelete = () => {
        if (!isNameTyped) return
        deleteDoc("Raven Workspace", workspaceID).then(() => {
            toast.success(_("Workspace deleted"))
            // Refreshing the list is enough to self-heal a stale active/last
            // workspace: WorkspaceLayout bounces out of a workspace that's no
            // longer in the list, and IndexRedirect ignores a deleted
            // lastWorkspace — both land on a valid workspace.
            globalMutate("workspaces_list")
            globalMutate("channel_list")
            onDeleted()
        })
    }

    return (
        <>
            <AlertDialogHeader>
                <AlertDialogTitle>{_("Delete {0}?", [workspaceName])}</AlertDialogTitle>
                <AlertDialogDescription>
                    {_("Are you sure you want to delete this workspace? If you proceed, all channels, threads and messages within the workspace will be deleted. This action cannot be undone.")}
                </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <ErrorBanner error={error} />}
            <div className="flex flex-col gap-2">
                <Label htmlFor="delete-workspace-name">{_("Enter the workspace name to confirm deletion")}</Label>
                <Input
                    id="delete-workspace-name"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder={workspaceName}
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={loading}>{_("Cancel")}</AlertDialogCancel>
                <Button variant="solid" theme="red" disabled={loading || !isNameTyped} onClick={handleDelete}>
                    {loading && <Spinner />}
                    {loading ? _("Deleting...") : _("Delete")}
                </Button>
            </AlertDialogFooter>
        </>
    )
}

export default WorkspaceActionMenu
