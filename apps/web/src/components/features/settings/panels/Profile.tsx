import { useForm } from "react-hook-form"
import { FrappeError, useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import type { RavenUser } from "@raven/types/Raven/RavenUser"
import { getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { ProfileImageMenu } from "@components/features/profile/ProfileImageMenu"
import { Button } from "@components/ui/button"
import { Form } from "@components/ui/form"
import { DataField, SelectFormField } from "@components/ui/form-elements"
import { SelectItem } from "@components/ui/select"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { errorResponseToast } from "@components/ui/error-banner"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/** Lets the Save button live in the panel HEADER, outside the <form>. */
const FORM_ID = "settings-profile-form"

const STATUS_OPTIONS = [
    { value: "Available", label: _("Available") },
    { value: "Away", label: _("Away") },
    { value: "Do not disturb", label: _("Do not disturb") },
    { value: "Invisible", label: _("Invisible") },
] as const

type ProfileFormValues = {
    full_name: string
    availability_status: string
    custom_status: string
    contact_number: string
}

/**
 * Desktop Profile panel (v2's UserProfile page + the phone number field).
 * Mobile edits the same fields through EditProfileDrawer — same wire format:
 * one frappe.client.set_value on the Raven User, then my_profile revalidates.
 * The panel mounts fresh each time its tab opens (Radix Tabs unmounts inactive
 * panels), so seeding the form via defaultValues is enough — no reset effects.
 */
const Profile = () => {
    const { myProfile } = useCurrentRavenUser()

    // my_profile is warm from boot in practice; the guard covers a cold cache
    if (!myProfile) return null

    return <ProfileForm myProfile={myProfile} />
}

const ProfileForm = ({ myProfile }: { myProfile: RavenUser }) => {
    const { mutate } = useCurrentRavenUser()
    const { call } = useFrappePostCall("frappe.client.set_value")

    const form = useForm<ProfileFormValues>({
        defaultValues: {
            full_name: myProfile.full_name ?? "",
            availability_status: myProfile.availability_status ?? "",
            custom_status: myProfile.custom_status ?? "",
            contact_number: myProfile.contact_number ?? "",
        },
    })

    const onSubmit = async (values: ProfileFormValues) => {
        try {
            await call({ doctype: "Raven User", name: myProfile.name, fieldname: values })
            await mutate()
            toast.success(_("Profile updated"))
            // The saved values are the new pristine state — Save disables again
            form.reset(values)
        } catch (e) {
            errorResponseToast(_("Could not update profile"), e as FrappeError)
        }
    }

    return (
        <>
            <SettingsPanelHeader
                actions={
                    <Button
                        type="submit"
                        form={FORM_ID}
                        size="md"
                        loading={form.formState.isSubmitting}
                        loadingText={_("Saving...")}
                        disabled={!form.formState.isDirty}
                    >
                        {_("Save")}
                    </Button>
                }
            >
                <SettingsPanelTitle>{_("Profile")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Manage your Raven profile")}</SettingsPanelDescription>
            </SettingsPanelHeader>

            <SettingsPanelContent>
                <div className="flex w-full flex-col gap-6 py-2">
                    {/* Tapping the avatar opens the upload / remove photo menu — the
                        same component the mobile profile page uses. Photo changes
                        apply immediately (not part of the form's save). */}
                    <div className="flex items-center justify-center rounded-lg bg-surface-gray-1 dark:bg-surface-gray-2 py-6">
                        <ProfileImageMenu />
                    </div>

                    <Form {...form}>
                        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
                            <DataField
                                name="full_name"
                                label={_("Full name")}
                                isRequired
                                rules={{
                                    required: _("Name is required"),
                                    maxLength: { value: 140, message: _("Name cannot be more than 140 characters.") },
                                }}
                            />

                            <SelectFormField name="availability_status" label={_("Availability")}>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        <span className="flex items-center gap-2">
                                            <span className={cn("size-2 rounded-full", getStatusIndicatorColor(option.value))} />
                                            {option.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectFormField>

                            <DataField
                                name="custom_status"
                                label={_("Status")}
                                formDescription={_("Share what you are up to")}
                                inputProps={{ placeholder: _("e.g. Out of office") }}
                                rules={{
                                    maxLength: { value: 140, message: _("Status cannot be more than 140 characters.") },
                                }}
                            />

                            <DataField
                                name="contact_number"
                                label={_("Phone")}
                                formDescription={_("Shown on your profile")}
                                inputProps={{ placeholder: "+91 9999 999 999", type: "tel" }}
                            />
                        </form>
                    </Form>
                </div>
            </SettingsPanelContent>
        </>
    )
}

export default Profile
