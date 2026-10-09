import { useEffect } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import { errorResponseToast } from "@components/ui/error-banner"
import { DataField } from "@components/ui/form-elements"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"
import { AdminSettingsForm } from "./AdminSettingsForm"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"

const FORM_ID = "settings-notifications-form"
const DEFAULT_RAVEN_CLOUD_URL = "https://cloud.ravenchat.ai"

// Credentials must not be autofilled. "new-password" is the one autocomplete value
// browsers honour for "never fill"; the data-* flags opt out of 1Password / LastPass.
const NO_AUTOFILL = { autoComplete: "new-password", "data-1p-ignore": true, "data-lpignore": "true" }

/**
 * Own component, not a render prop — see AdminSettingsForm.
 *
 * The web app only sends push through Raven Cloud, so there is no service picker.
 * A site still set to Frappe Cloud (a v2-era option) gets a banner with a one-click
 * switch; the form then saves the service as Raven along with the credentials.
 */
const PushNotificationFields = () => {
    const { control, setValue } = useFormContext<RavenSettings>()
    const service = useWatch({ control, name: "push_notification_service" })
    const usesFrappeCloud = service === "Frappe Cloud"

    // A site that never chose a service saves as Raven Cloud. This coerces the
    // loaded value; the parent form resets from the server doc after mount.
    useEffect(() => {
        if (!service) setValue("push_notification_service", "Raven")
    }, [service, setValue])

    const switchToRavenCloud = () => {
        setValue("push_notification_service", "Raven", { shouldDirty: true })
        setValue("push_notification_server_url", DEFAULT_RAVEN_CLOUD_URL, { shouldDirty: true })
    }

    if (usesFrappeCloud) {
        return (
            <Alert theme="amber">
                <TriangleAlertIcon />
                <AlertTitle className="text-start">{_("This site sends push notifications through Frappe Cloud.")}</AlertTitle>
                <AlertDescription>
                    <span>
                        {_("The new Raven web app only supports Raven Cloud. Switch to Raven Cloud and add your credentials to keep push notifications working.")}
                    </span>
                    <div className="mt-2">
                        <Button type="button" variant="subtle" size="sm" onClick={switchToRavenCloud}>{_("Switch to Raven Cloud")}</Button>
                    </div>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <>
            <div className="text-p-sm text-ink-gray-7">
                <p>{_("Push notifications are sent through Raven Cloud. To set it up:")}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>
                        <a
                            href={DEFAULT_RAVEN_CLOUD_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-ink-blue-link underline"
                        >
                            {_("Create a Raven Cloud account")}
                            <ExternalLinkIcon className="size-3.5" />
                        </a>{" "}
                        {_("and add your site to get an API Key and API Secret.")}
                    </li>
                    <li>{_("Enter the credentials below and save.")}</li>
                    <li>{_("Register the site on Raven Cloud, then sync your users' devices.")}</li>
                </ol>
            </div>

            <DataField
                name="push_notification_server_url"
                label={_("Push Notification Server URL")}
                isRequired
                rules={{
                    required: _("Please add your Push Notification Server URL"),
                    maxLength: { value: 300, message: _("URL cannot be more than 300 characters.") },
                }}
                inputProps={{ placeholder: DEFAULT_RAVEN_CLOUD_URL, autoComplete: "off", maxLength: 300 }}
                formDescription={
                    <>
                        {_("You can keep this as \"{0}\" if you are using the default Raven Cloud instance.", [DEFAULT_RAVEN_CLOUD_URL])}
                        <br />
                        {_("Only change this if you are using a custom Raven Cloud instance.")}
                    </>
                }
            />
            <DataField
                name="push_notification_api_key"
                label={_("Push Notification API Key")}
                rules={{ maxLength: { value: 140, message: _("API Key cannot be more than 140 characters.") } }}
                inputProps={{ placeholder: _("Your API Key"), ...NO_AUTOFILL }}
            />
            <DataField
                name="push_notification_api_secret"
                label={_("API Secret")}
                isRequired
                rules={{ required: _("Please add your Push Notification API Secret") }}
                inputProps={{ type: "password", placeholder: "••••••••••••••••••••••••••••••••", ...NO_AUTOFILL }}
            />

            <ServiceActions />
        </>
    )
}

/**
 * Register / Sync buttons act on the SAVED settings, not the form, so they only
 * appear once Raven Cloud is saved with a server URL, or while Frappe Cloud setup
 * is pending (and, for Sync, a VAPID key from a successful registration).
 */
const ServiceActions = () => {
    const { ravenSettings, mutate } = useRavenSettings()
    // Each endpoint checks a different role, so each button is gated by exactly that role.
    const canRegister = hasRole("System Manager")
    const canSync = hasRole("Raven Admin")
    const savedRavenCloud = ravenSettings?.push_notification_service === "Raven" && Boolean(ravenSettings?.push_notification_server_url)
    // On Frappe Cloud, a System Manager can retry a setup that failed before anything was saved.
    const frappeCloudSetupPending = Boolean(window.frappe?.boot?.raven_cloud_push_setup_pending)

    if (!savedRavenCloud && !frappeCloudSetupPending) return null
    return (
        <div className="flex flex-wrap gap-2">
            <RegisterSiteButton registered={Boolean(ravenSettings?.vapid_public_key)} disabled={!canRegister} onDone={() => mutate()} />
            {ravenSettings?.vapid_public_key && <SyncDataButton disabled={!canSync} />}
        </div>
    )
}

const RegisterSiteButton = ({ registered, disabled, onDone }: { registered: boolean; disabled: boolean; onDone: () => void }) => {
    const { call, loading } = useFrappePostCall("raven.api.notification.register_site_on_raven_cloud")

    const register = () => {
        call({})
            .then(() => {
                toast.success(_("Site registered on Raven Cloud. You can now send push notifications."))
                onDone()
            })
            .catch((e) => errorResponseToast(_("Failed to register site on Raven Cloud"), e))
    }

    return (
        <Button type="button" variant="outline" size="sm" onClick={register} disabled={disabled} loading={loading} loadingText={_("Registering site on Raven Cloud...")}>
            {registered ? _("Re-Register Site on Raven Cloud") : _("Register Site on Raven Cloud")}
        </Button>
    )
}

const SyncDataButton = ({ disabled }: { disabled: boolean }) => {
    const { call, loading } = useFrappePostCall("raven.api.notification.sync_user_tokens_to_raven_cloud")

    const sync = () => {
        call({})
            .then(() => toast.success(_("Data synced to Raven Cloud.")))
            .catch((e) => errorResponseToast(_("Failed to sync data to Raven Cloud"), e))
    }

    return (
        <Button type="button" variant="outline" size="sm" onClick={sync} disabled={disabled} loading={loading} loadingText={_("Syncing Data to Raven Cloud...")}>
            {_("Sync Data to Raven Cloud")}
        </Button>
    )
}

/**
 * Push Notifications — Raven Cloud credentials plus the registration and sync
 * actions. The web app has no Frappe Cloud relay, so that v2 option is not offered.
 */
export const PushNotifications = () => (
    <AdminSettingsForm
        title={_("Push Notifications")}
        description={_("Configure the push notification service here.")}
        formId={FORM_ID}
    >
        <PushNotificationFields />
    </AdminSettingsForm>
)

export default PushNotifications
