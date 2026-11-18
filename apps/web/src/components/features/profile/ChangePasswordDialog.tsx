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
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { Form } from "@components/ui/form"
import { CheckboxFormField, PasswordField } from "@components/ui/form-elements"
import ErrorBanner from "@components/ui/error-banner"
import { useIsMobile } from "@hooks/use-mobile"
import { hasRole } from "@lib/permissions"
import { getPushToken } from "@lib/push"
import { siteUrl } from "@lib/site"
import _ from "@lib/translate"

/** Lets the submit button live outside the <form> (sheet buttons / dialog footer). */
const FORM_ID = "change-password-form"

type ChangePasswordForm = {
    new_password: string
    logout_all_sessions: 0 | 1
}

type ChangePasswordRequest = ReturnType<typeof useFrappePostCall>

/** A sheet on mobile, a dialog on desktop. Opened from the Profile page and Settings → Profile. */
const ChangePasswordDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
    const isMobile = useIsMobile()
    const request = useFrappePostCall("raven.api.account.change_password")

    // Stays open while the change runs, so its outcome is never lost. The close after a save
    // calls onOpenChange directly: it runs before `loading` re-renders as false.
    const setOpen = (next: boolean) => {
        if (request.loading) return
        if (next) request.reset()
        onOpenChange(next)
    }

    const description = _("You'll stay logged in on this device.")
    const form = open && <ChangePasswordFormBody request={request} isMobile={isMobile} onSaved={() => onOpenChange(false)} />

    if (isMobile) {
        // Laid out like EditProfileDrawer, its neighbour on the Profile page.
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                {/* Keeps the keyboard down until the field is tapped. */}
                <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DrawerTitle className="sr-only">{_("Change password")}</DrawerTitle>
                    <DrawerDescription className="sr-only">{description}</DrawerDescription>
                    <div className="flex flex-col gap-4 p-4 pb-2">
                        <h2 className="text-xl font-medium text-ink-gray-8">{_("Change password")}</h2>
                        {form}
                        <div className="flex gap-2 pt-4">
                            <Button type="button" variant="outline" size="lg" className="flex-1" disabled={request.loading} onClick={() => setOpen(false)}>
                                {_("Cancel")}
                            </Button>
                            <Button type="submit" form={FORM_ID} size="lg" className="flex-1" loading={request.loading}>
                                {_("Change")}
                            </Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {/* Anchored near the top, so an error line grows it downward instead of shifting it. */}
            <DialogContent className="sm:max-w-md top-[20vh] translate-y-0 max-h-[75vh]">
                <DialogHeader>
                    <DialogTitle>{_("Change password")}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBody>{form}</DialogBody>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button size="md" type="button" variant="outline" disabled={request.loading}>{_("Cancel")}</Button>
                    </DialogClose>
                    <Button size="md" type="submit" form={FORM_ID} variant="solid" loading={request.loading} loadingText={_("Changing")}>
                        {_("Change")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const ChangePasswordFormBody = ({ request, isMobile, onSaved }: { request: ChangePasswordRequest; isMobile: boolean; onSaved: VoidFunction }) => {
    // The site may always log out other devices; then the box shows that instead of offering a choice.
    const logoutForced = window.frappe?.boot?.raven_logout_on_password_reset === 1
    // Only a System Manager can change System Settings.
    const canChangeSetting = logoutForced && hasRole("System Manager")
    const form = useForm<ChangePasswordForm>({
        defaultValues: { new_password: "", logout_all_sessions: 1 },
    })
    const { call: changePassword, error } = request

    const onSubmit = (values: ChangePasswordForm) => {
        changePassword({ ...values, keep_push_token: getPushToken() })
            .then(() => {
                toast.success(_("Password changed"))
                onSaved()
            })
            .catch(() => {
                // Shown in the banner.
            })
    }

    return (
        <Form {...form}>
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                {error && <ErrorBanner error={error} />}
                {/* Mobile sizing and labels follow EditProfileDrawer. */}
                <PasswordField
                    name="new_password"
                    label={_("New password")}
                    isRequired={!isMobile}
                    rules={{ required: _("New password is required") }}
                    className={isMobile ? "h-9" : undefined}
                    inputProps={{ autoComplete: "new-password", className: isMobile ? "text-xl" : undefined }}
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
            </form>
        </Form>
    )
}

export default ChangePasswordDialog
