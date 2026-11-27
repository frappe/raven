import dayjs from "dayjs"
import { useForm, useWatch } from "react-hook-form"
import { SAVE_TOAST_ID } from "@lib/toast"
import useSaveHotkey from "@hooks/useSaveHotkey"
import { FrappeError, useFrappeUpdateDoc } from "frappe-react-sdk"
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
import { useStatusUntilLabel } from "@components/common/StatusUntil"
import { ClearAfterField } from "@components/features/profile/ClearAfterField"
import { getStatusFormValues, getStatusPayload, type StatusFormValues } from "@components/features/profile/statusForm"
import { toServerDatetime } from "@lib/timeUtils"
import { availabilityOptions } from "@hooks/useSetAvailability"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/** Lets the Save button live in the panel HEADER, outside the <form>. */
const FORM_ID = "settings-profile-form"

type ProfileFormValues = StatusFormValues & {
    full_name: string
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
    const { updateDoc } = useFrappeUpdateDoc()

    const form = useForm<ProfileFormValues>({
        defaultValues: {
            ...getStatusFormValues(myProfile, toServerDatetime(dayjs())),
            full_name: myProfile.full_name ?? "",
            contact_number: myProfile.contact_number ?? "",
        },
    })

    const [availability, availabilityEndsAt] = useWatch({ control: form.control, name: ["availability_status", "availability_expires_at"] })
    const seededAvailability = form.formState.defaultValues?.availability_status
    const availabilityUntil = useStatusUntilLabel(availability === seededAvailability ? availabilityEndsAt : null)

    const onSubmit = async (values: ProfileFormValues) => {
        const status = getStatusPayload(values, seededAvailability)
        updateDoc("Raven User", myProfile.name, {
            full_name: values.full_name,
            contact_number: values.contact_number,
            ...status,
        })
            .then(() => {
                toast.success(_("Profile updated"), { id: SAVE_TOAST_ID })
                mutate()
                // The saved ends become the form's own: a second save resends them as they
                // are, instead of restarting a duration from then.
                const savedEnds = {
                    availability_expires_at: status.availability_expires_at,
                    clear_after: status.custom_status_expires_at ? "at" : "never",
                    clear_after_at: status.custom_status_expires_at,
                } as const
                form.setValue("availability_expires_at", savedEnds.availability_expires_at)
                form.setValue("clear_after", savedEnds.clear_after)
                form.setValue("clear_after_at", savedEnds.clear_after_at)
                // The submitted values, not live ones: edits typed during the request stay unsaved.
                const saved = { ...values, ...savedEnds }
                // The saved values become the new PRISTINE state (Save disables
                // again) — via keepValues, which only swaps the defaults under
                // the untouched inputs. A full reset(values) rewires the mounted
                // controlled fields, and typing after it stopped registering:
                // keystrokes fired input events but the controllers snapped the
                // value back every time. keepValues never touches the fields, so
                // there is nothing to rewire.
                form.reset(saved, { keepValues: true })
            }).catch((e) => {
                errorResponseToast(_("Could not update profile"), e as FrappeError, { id: SAVE_TOAST_ID })
            })
    }

    // Same gate as the Save button: nothing to save, or a save in flight, is a no-op.
    useSaveHotkey(() => {
        if (form.formState.isDirty && !form.formState.isSubmitting) form.handleSubmit(onSubmit)()
    })

    return (
        <>
            <SettingsPanelHeader
                actions={
                    <Button
                        type="submit"
                        form={FORM_ID}
                        size="sm"
                        loading={form.formState.isSubmitting}
                        loadingText={_("Saving")}
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

                            <SelectFormField name="availability_status" label={_("Availability")} formDescription={availabilityUntil}>
                                {availabilityOptions().map((option) => (
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
                            <ClearAfterField />

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
