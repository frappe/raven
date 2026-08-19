import { useFormContext, useWatch } from "react-hook-form"
import { Separator } from "@components/ui/separator"
import { DataField, SelectFormField } from "@components/ui/form-elements"
import { SelectItem } from "@components/ui/select"
import { AdminSettingsForm } from "./AdminSettingsForm"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"
import _ from "@lib/translate"

const FORM_ID = "settings-notifications-form"

/** Own component, not a render prop — see AdminSettingsForm. */
const PushNotificationFields = () => {
    const { control } = useFormContext<RavenSettings>()
    const service = useWatch({ control, name: "push_notification_service" })

    return (
        <>
            <SelectFormField
                name="push_notification_service"
                label={_("Push Notification Service")}
                formDescription={_("Where push notifications are sent from.")}
            >
                <SelectItem value="Frappe Cloud">{_("Frappe Cloud")}</SelectItem>
                <SelectItem value="Raven">{_("Raven Cloud")}</SelectItem>
            </SelectFormField>

            {service === "Raven" ? (
                <>
                    <Separator />
                    <DataField
                        name="push_notification_server_url"
                        label={_("Server URL")}
                        inputProps={{ placeholder: "https://…", autoComplete: "off" }}
                    />
                    <DataField
                        name="push_notification_api_key"
                        label={_("API Key")}
                        inputProps={{ autoComplete: "off" }}
                    />
                    <DataField
                        name="push_notification_api_secret"
                        label={_("API Secret")}
                        inputProps={{ type: "password", placeholder: "••••••••••••••••••••", autoComplete: "off" }}
                    />
                </>
            ) : null}
        </>
    )
}

/**
 * Notifications — the push notification service configuration (Frappe Cloud vs
 * Raven Cloud). Ported from v2's PushNotifications; the Raven Cloud credential
 * fields show only when that service is selected.
 *
 * Note: registering the site on Raven Cloud + syncing tokens are separate admin
 * actions (raven.api.notification.*) not surfaced here yet.
 */
export const PushNotifications = () => (
    <AdminSettingsForm
        title={_("Notifications")}
        description={_("Configure the push notification service here.")}
        formId={FORM_ID}
    >
        <PushNotificationFields />
    </AdminSettingsForm>
)

export default PushNotifications
