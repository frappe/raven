import { useState } from "react"
import { useFrappeDeleteDoc } from "frappe-react-sdk"
import { toast } from "sonner"
import { EllipsisVertical, Trash2Icon } from "lucide-react"
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import ErrorBanner from "@components/ui/error-banner"
import _ from "@lib/translate"

type Props = {
    /** DocType to delete from. */
    doctype: string
    /** Name of the record to delete. */
    docName: string
    /** Confirm-dialog heading, e.g. "Delete Webhook?". */
    deleteTitle: string
    /** Confirm-dialog body text. Should name the record being deleted. */
    deleteDescription: string
    /** Toast on success. Defaults to "Deleted". */
    deleteSuccessMessage?: string
    /** Called after a successful delete (e.g. navigate back to the list). */
    onDeleted: () => void
    /** Extra menu items rendered above Delete (e.g. Enable/Disable). */
    children?: React.ReactNode
}

/** Kebab menu for a settings detail/edit view: any extra actions, then Delete (confirmed). */
export const RecordActionsMenu = ({
    doctype, docName, deleteTitle, deleteDescription, deleteSuccessMessage, onDeleted, children,
}: Props) => {
    const [deleteOpen, setDeleteOpen] = useState(false)
    const { deleteDoc, loading, error } = useFrappeDeleteDoc()

    const onDelete = () => {
        deleteDoc(doctype, docName).then(() => {
            toast.success(deleteSuccessMessage ?? _("Deleted"))
            setDeleteOpen(false)
            onDeleted()
        }).catch(() => { /* surfaced by the error banner */ })
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" isIconButton aria-label={_("Options")}>
                        <EllipsisVertical />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {children}
                    {children && <DropdownMenuSeparator />}
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                        <Trash2Icon />
                        {_("Delete")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    {error && <ErrorBanner error={error} />}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>{_("Cancel")}</AlertDialogCancel>
                        <Button variant="solid" theme="red" size="md" onClick={onDelete} loading={loading} loadingText={_("Deleting")}>
                            {_("Delete")}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export default RecordActionsMenu
