import { useFrappeUpdateDoc } from "frappe-react-sdk"
import { toast } from "sonner"
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import type { UserData } from "@db"
import _ from "@lib/translate"

type Props = {
    user: UserData
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Confirms before disabling a user's Frappe account. This is the whole site account,
 * not just Raven: the user is logged out everywhere. Raven's own flag follows from the
 * User save hook, and the realtime event refreshes the row.
 */
const DisableUserDialog = ({ user, open, onOpenChange }: Props) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc()

    const disable = () => {
        updateDoc("User", user.name, { enabled: 0 })
            .then(() => {
                toast.success(_("{0} has been disabled", [user.full_name || user.name]))
                onOpenChange(false)
            })
            .catch(() => { /* shown in the banner */ })
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{_("Disable {0}?", [user.full_name || user.name])}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {_("This disables their account on this site. They will be logged out everywhere and cannot log in until the account is enabled again.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && <ErrorBanner error={error} />}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>{_("Cancel")}</AlertDialogCancel>
                    <Button variant="solid" theme="red" size="md" onClick={disable} loading={loading} loadingText={_("Disabling")}>
                        {_("Disable")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default DisableUserDialog
