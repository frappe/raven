import { useState, useContext } from "react"
import { useForm } from "react-hook-form"
import { FrappeConfig, FrappeContext, useFrappePostCall } from "frappe-react-sdk"
import { PlusIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormRequiredIndicator,
} from "@components/ui/form"
import { Input } from "@components/ui/input"
import { DataField } from "@components/ui/form-elements"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import { usersStore } from "@stores/usersStore"
import _ from "@lib/translate"

interface UserFormFields {
    email: string
    first_name: string
    last_name: string
}

/** Invite a user to Raven — or add an existing Frappe user as a Raven User. */
const AddUserDialog = () => {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <PlusIcon />
                    {_("Add User")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{_("Add User")}</DialogTitle>
                    <DialogDescription>{_("Invite a new user to Raven.")}</DialogDescription>
                </DialogHeader>
                {open && <UserForm onClose={() => setOpen(false)} />}
            </DialogContent>
        </Dialog>
    )
}

const UserForm = ({ onClose }: { onClose: VoidFunction }) => {
    const form = useForm<UserFormFields>()

    const [fetching, setFetching] = useState(false)
    const [userExists, setUserExists] = useState(false)
    const [ravenUserExists, setRavenUserExists] = useState(false)

    const { call } = useContext(FrappeContext) as FrappeConfig
    const { loading, call: inviteUser, error } = useFrappePostCall("raven.api.raven_users.invite_user")

    const onEmailBlur = () => {
        const email = form.getValues("email")
        if (!email) {
            setUserExists(false)
            setRavenUserExists(false)
            setFetching(false)
            return
        }
        if (usersStore.getUser(email)) {
            setRavenUserExists(true)
            setUserExists(false)
            return
        }
        setRavenUserExists(false)
        setFetching(true)
        call
            .get("frappe.client.get_value", {
                doctype: "User",
                filters: [["email", "=", email]],
                fieldname: "name",
            })
            .then((res: { message?: { name?: string } }) => {
                const exists = Boolean(res.message?.name)
                setUserExists(exists)
                if (exists) {
                    // Unregister first/last name so their required rules don't block submit
                    form.unregister(["first_name", "last_name"])
                }
            })
            .catch(() => setUserExists(false))
            .finally(() => setFetching(false))
    }

    const onSubmit = (data: UserFormFields) => {
        inviteUser(data).then(() => onClose())
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {error && <ErrorBanner error={error} />}
                {/* Email field — uses FormField directly to attach the onBlur lookup */}
                <FormField
                    control={form.control}
                    name="email"
                    rules={{ required: _("Email is required") }}
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>
                                {_("Email")}
                                <FormRequiredIndicator />
                            </FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    type="email"
                                    autoFocus
                                    placeholder="email@example.com"
                                    disabled={fetching || loading}
                                    onBlur={() => {
                                        field.onBlur()
                                        onEmailBlur()
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {ravenUserExists && (
                    <p className="text-p-sm text-ink-red-3">{_("This user is already on Raven.")}</p>
                )}
                {!userExists && (
                    <>
                        <DataField
                            name="first_name"
                            label={_("First Name")}
                            isRequired
                            rules={{
                                required: _("First Name is required"),
                                maxLength: { value: 140, message: _("First name must be less than 140 characters") },
                            }}
                        />
                        <DataField
                            name="last_name"
                            label={_("Last Name")}
                            isRequired
                            rules={{
                                required: _("Last Name is required"),
                                maxLength: { value: 140, message: _("Last name must be less than 140 characters") },
                            }}
                        />
                    </>
                )}
                <p className="text-p-sm text-ink-gray-5">
                    {userExists
                        ? _("This user already exists in Frappe. Add them to Raven?")
                        : _("An invite will be sent on their email.")}
                </p>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button size="md" type="button" variant="outline" disabled={loading}>
                            {_("Cancel")}
                        </Button>
                    </DialogClose>
                    <Button size="md" type="submit" disabled={ravenUserExists || loading || fetching}>
                        {loading && <Spinner />}
                        {userExists ? _("Add") : _("Send Invite")}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default AddUserDialog
