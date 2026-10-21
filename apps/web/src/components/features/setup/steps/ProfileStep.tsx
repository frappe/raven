import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useFrappeUpdateDoc, type FrappeError } from "frappe-react-sdk"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import type { RavenUser } from "@raven/types/Raven/RavenUser"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { Form } from "@components/ui/form"
import { DataField } from "@components/ui/form-elements"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { markOnboardedInBootCache } from "@utils/setup"
import { ImageUploadField } from "./ImageUploadField"
import { buildProfileUpdate } from "./profileUpdate"
import { StepFooter } from "./StepFooter"
import { useReportBusy } from "./useReportBusy"
import type { SetupStepBodyProps } from "../types"

type ProfileForm = { full_name: string; user_image: string; password: string }

type ProfileStepProps = SetupStepBodyProps & {
    /** A Frappe Cloud signup lands here before any wizard asked for a password; the mobile app needs one. */
    askPassword?: boolean
}

/** Name and photo, so the team knows who this is. Continue also marks the user onboarded. */
export const ProfileStep = (props: ProfileStepProps) => {
    const { myProfile, error, mutate } = useCurrentRavenUser()
    // The form starts from the saved profile; wait for it. A failed request would otherwise leave
    // the step blank with no way on, as the hook doesn't retry by itself.
    if (!myProfile) {
        if (!error) return null
        return (
            <div className="flex flex-col gap-4">
                <ErrorBanner error={error} />
                <StepFooter>
                    <Button variant="outline" size="md" onClick={() => mutate()}>
                        {_("Retry")}
                    </Button>
                </StepFooter>
            </div>
        )
    }
    return <ProfileFormBody key={myProfile.name} {...props} profile={myProfile} onSaved={() => mutate()} />
}

const ProfileFormBody = ({ isLast, finishing, onDone, onPreview, onBusyChange, profile, onSaved, askPassword = false }: ProfileStepProps & { profile: RavenUser; onSaved: () => void }) => {
    // The name comes from the User record, which Frappe Cloud fills in at signup.
    const form = useForm<ProfileForm>({ defaultValues: { full_name: profile.full_name ?? "", user_image: profile.user_image ?? "", password: "" } })
    const typedName = useWatch({ control: form.control, name: "full_name" })
    const typedImage = useWatch({ control: form.control, name: "user_image" })
    const typedPassword = useWatch({ control: form.control, name: "password" })
    const { updateDoc, loading, error } = useFrappeUpdateDoc()
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    useReportBusy(loading || uploadingPhoto, onBusyChange)
    const isMobile = useIsMobile()

    useEffect(() => {
        onPreview({ profile: { name: typedName ?? "", image: typedImage || undefined } })
    }, [typedName, typedImage]) // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = (values: ProfileForm) => {
        // Mid-upload, the save would go out without the photo.
        if (loading || finishing || uploadingPhoto) return
        updateDoc("Raven User", profile.name, buildProfileUpdate(profile, values))
            // A Raven User is named after its User. Saving new_password there is how Desk's "My Settings"
            // sets it. The profile, and the onboarded flag, live on the Raven User, so that's a second write.
            .then(() => (askPassword ? updateDoc("User", profile.name, { new_password: values.password, logout_all_sessions: 0 }) : undefined))
            .then(() => {
                if (window.frappe?.boot) window.frappe.boot.raven_onboarded = 1
                markOnboardedInBootCache()
                onSaved()
                onDone()
            })
            .catch(() => { })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <p className="text-p-base text-ink-gray-7">{_("This is how you’ll appear to your team.")}</p>
                {error && <ErrorBanner error={error as FrappeError} />}
                <ImageUploadField
                    name="user_image"
                    label={_("Profile picture")}
                    shape="round"
                    attachTo={{ doctype: "Raven User", docname: profile.name, fieldname: "user_image" }}
                    onUploadingChange={setUploadingPhoto}
                />
                <DataField
                    name="full_name"
                    label={_("Full name")}
                    isRequired
                    rules={{
                        validate: (value) => !!value.trim() || _("Name is required"),
                        maxLength: { value: 140, message: _("Name cannot be more than 140 characters.") },
                    }}
                    inputProps={{ autoFocus: !isMobile }}
                />
                {askPassword && (
                    <DataField
                        name="password"
                        label={_("Password")}
                        isRequired
                        formDescription={_("You'll need it to sign in to this site.")}
                        rules={{ validate: (value) => !!value || _("Password is required") }}
                        inputProps={{ type: "password", autoComplete: "new-password" }}
                    />
                )}
                <StepFooter>
                    <Button type="submit" variant="solid" size="md" loading={loading || finishing} disabled={!typedName?.trim() || (askPassword && !typedPassword) || uploadingPhoto}>
                        {isLast ? _("Finish") : _("Continue")}
                    </Button>
                </StepFooter>
            </form>
        </Form>
    )
}
