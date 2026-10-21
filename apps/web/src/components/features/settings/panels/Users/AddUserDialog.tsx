import { useState, useContext } from "react"
import { useController, useForm } from "react-hook-form"
import { FrappeConfig, FrappeContext, useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogBody,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@components/ui/dialog"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormRequiredIndicator,
} from "@components/ui/form"
import { Input } from "@components/ui/input"
import { DataField } from "@components/ui/form-elements"
import ErrorBanner from "@components/ui/error-banner"
import { usersStore } from "@stores/usersStore"
import { useUserCookieData } from "@hooks/useUserCookieData"
import _ from "@lib/translate"
import { useWorkspaces } from "@hooks/useWorkspaces"
import useCreateHotkey from "@hooks/useCreateHotkey"
import WorkspaceAccessPicker from "./WorkspaceAccessPicker"
import useChannelsByWorkspace from "./useChannelsByWorkspace"

interface UserFormFields {
    email: string
    first_name: string
    last_name: string
    workspaces: string[]
    channels: string[]
}

/** Invite a user to Raven — or add an existing Frappe user as a Raven User. */
const AddUserDialog = () => {
    const [open, setOpen] = useState(false)
    useCreateHotkey(() => setOpen(true))

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <PlusIcon />
                    {_("Add User")}
                </Button>
            </DialogTrigger>
            {/* Anchored to the top instead of centred: expanding a workspace's channels
                then grows the dialog downward only, so the toggle just clicked stays put. */}
            <DialogContent className="sm:max-w-[480px] top-[10vh] translate-y-0 max-h-[80vh]">
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
    const { workspaces } = useWorkspaces()

    // With a single workspace there is nothing to choose, so it starts ticked.
    const form = useForm<UserFormFields>({
        defaultValues: { workspaces: workspaces.length === 1 ? [workspaces[0].name] : [], channels: [] },
    })

    const channelsByWorkspace = useChannelsByWorkspace()

    // The picker owns both fields; workspaces go through FormField below, channels through this controller.
    const channelsField = useController({ control: form.control, name: "channels" })

    const [fetching, setFetching] = useState(false)
    const [userExists, setUserExists] = useState(false)
    const [ravenUserExists, setRavenUserExists] = useState(false)
    const [isSelf, setIsSelf] = useState(false)
    const { name: currentUser } = useUserCookieData()

    const { call } = useContext(FrappeContext) as FrappeConfig
    const { loading, call: inviteUser, error } = useFrappePostCall("raven.api.raven_users.invite_user")

    const onEmailBlur = () => {
        const email = form.getValues("email")
        const self = email.trim().toLowerCase() === currentUser?.toLowerCase()
        setIsSelf(self)
        if (!email) {
            setUserExists(false)
            setRavenUserExists(false)
            setFetching(false)
            return
        }
        if (self || usersStore.getUser(email)) {
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
        inviteUser(data).then(() => {
            toast.success(userExists ? _("User added to Raven") : _("Invite sent"))
            onClose()
        })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
                <DialogBody className="flex flex-col gap-4">
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
                                {ravenUserExists && !isSelf ? (
                                    <FormMessage>{_("This user is already on Raven.")}</FormMessage>
                                ) : (
                                    <FormMessage />
                                )}
                                {isSelf && (
                                    <FormDescription>{_("That is you! No invite needed, you are already in.")}</FormDescription>
                                )}
                            </FormItem>
                        )}
                    />
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
                    {workspaces.length > 0 && (
                        <FormField
                            control={form.control}
                            name="workspaces"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>{_("Workspaces")}</FormLabel>
                                    <WorkspaceAccessPicker
                                        workspaces={workspaces}
                                        channelsByWorkspace={channelsByWorkspace}
                                        selectedWorkspaces={field.value}
                                        onWorkspacesChange={field.onChange}
                                        selectedChannels={channelsField.field.value}
                                        onChannelsChange={channelsField.field.onChange}
                                        disabled={loading}
                                    />
                                </FormItem>
                            )}
                        />
                    )}
                    <p className="text-p-sm text-ink-gray-6">
                        {userExists
                            ? _("This user already exists in Frappe. Add them to Raven?")
                            : _("An invite will be sent on their email.")}
                    </p>
                </DialogBody>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button size="md" type="button" variant="outline" disabled={loading}>
                            {_("Cancel")}
                        </Button>
                    </DialogClose>
                    <Button size="md" type="submit" disabled={ravenUserExists || fetching} loading={loading} loadingText={_("Sending Invite...")}>
                        {userExists ? _("Add") : _("Send Invite")}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default AddUserDialog
