import { useState } from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import { Trash2, Loader2 } from 'lucide-react'
import { useFrappeDeleteDoc } from 'frappe-react-sdk'
import _ from "@lib/translate"

interface DeleteEmojiDialogProps {
    /** The document name (ID) of the emoji to delete */
    emojiId: string
    /** Display name of the emoji (for the confirmation message) */
    emojiName: string
    /** Callback fired after successful deletion */
    onDelete: () => void
}

export function DeleteEmojiDialog({ emojiId, emojiName, onDelete }: DeleteEmojiDialogProps) {
    const [open, setOpen] = useState(false)
    const { deleteDoc, loading } = useFrappeDeleteDoc()

    const handleDelete = () => {
        deleteDoc('Raven Custom Emoji', emojiId).then(() => {
            setOpen(false)
            onDelete()
        })
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    theme="red"
                    aria-label={_("Delete emoji")}
                    className='opacity-0 group-hover:opacity-100 transition-opacity'
                    isIconButton
                >
                    <Trash2 />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{_("Delete :{0}:?", [emojiName])}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {_("This action cannot be undone. This will permanently delete the emoji and it will no longer be available in reactions or messages.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>{_("Cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? _("Deleting...") : _("Delete")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default DeleteEmojiDialog
