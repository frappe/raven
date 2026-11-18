import { useForm } from "@lib/form"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@components/ui/dialog"
import { Form } from "@components/ui/form"
import { CheckboxFormField, PasswordField } from "@components/ui/form-elements"
import ErrorBanner from "@components/ui/error-banner"
import { useIsMobile } from "@hooks/use-mobile"
import { hasRole } from "@lib/permissions"
import { getPushToken } from "@lib/push"
import { siteUrl } from "@lib/site"
import _ from "@lib/translate"

type ChangePasswordForm = {
    new_password: string
    logout_all_sessions: 0 | 1
}

/** Opened from Settings → Profile on desktop and the Profile page on mobile. */
const ChangePasswordDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
    const isMobile = useIsMobile()
    const request = useFrappePostCall("raven.api.account.change_password")

    // Stays open while the change runs, so its outcome is never lost.
    const setOpen = (next: boolean) => {
        if (request.loading) return
        if (next) request.reset()
        onOpenChange(next)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {/* Anchored near the top, so an error line grows it downward instead of shifting it.
                Radix focuses the first input on open; on mobile that pops the keyboard. */}
            <DialogContent className="sm:max-w-md top-[20vh] translate-y-0 max-h-[75vh]" onOpenAutoFocus={isMobile ? (e) => e.preventDefault() : undefined}>
                <DialogHeader>
                    <DialogTitle>{_("Change password")}</DialogTitle>
                    <DialogDescription>{_("You'll stay logged in on this device.")}</DialogDescription>
                </DialogHeader>
                {open && <ChangePasswordFormBody request={request} onClose={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    )
}

const ChangePasswordFormBody = ({ request, onClose }: { request: ReturnType<typeof useFrappePostCall>; onClose: VoidFunction }) => {
    // The site may always log out other devices; then the box shows that instead of offering a choice.
    const logoutForced = window.frappe?.boot?.raven_logout_on_password_reset === 1
    // Only a System Manager can change System Settings.
    const canChangeSetting = logoutForced && hasRole("System Manager")
    const form = useForm<ChangePasswordForm>({
        defaultValues: { new_password: "", logout_all_sessions: 1 },
    })
    const { call: changePassword, loading, error } = request

    const onSubmit = (values: ChangePasswordForm) => {
        changePassword({ ...values, keep_push_token: getPushToken() })
            .then(() => {
                toast.success(_("Password changed"))
                onClose()
            })
            .catch(() => {
                // Shown in the banner.
            })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
                <DialogBody className="flex flex-col gap-4">
                    {error && <ErrorBanner error={error} />}
                    <PasswordField
                        name="new_password"
                        label={_("New password")}
                        isRequired
                        rules={{ required: _("New password is required") }}
                        inputProps={{ autoComplete: "new-password" }}
                    />
                    <CheckboxFormField
                        name="logout_all_sessions"
                        label={_("Log out of other devices")}
                        readOnly={logoutForced}
                        formDescription={logoutForced && (
                            <>
                                {_("Enabled site-wide.")}{" "}
                                {canChangeSetting && (
                                    <a href={siteUrl("/app/system-settings#password_tab")} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-gray-8">
                                        {_("Change in System Settings")}
                                    </a>
                                )}
                            </>
                        )}
                    />
                </DialogBody>
                <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end">
                    <DialogClose asChild>
                        <Button size="md" type="button" variant="outline" disabled={loading}>
                            {_("Cancel")}
                        </Button>
                    </DialogClose>
                    <Button size="md" type="submit" variant="solid" loading={loading} loadingText={_("Changing")}>
                        {_("Change password")}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default ChangePasswordDialog
