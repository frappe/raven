import { useFormContext, useWatch } from "react-hook-form"
import { Separator } from "@components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { SelectFormField, SwitchFormField } from "@components/ui/form-elements"
import { SelectItem } from "@components/ui/select"
import { AdminSettingsForm } from "./AdminSettingsForm"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"
import { AlertTriangleIcon } from "lucide-react"
import _ from "@lib/translate"

const FORM_ID = "settings-hr-form"

/** Frappe HR is a separate app — its settings only make sense when it's installed. */
const isHRInstalled = () => window?.frappe?.boot?.versions?.hrms !== undefined

/** Own component, not a render prop — see AdminSettingsForm. */
const FrappeHRFields = () => {
    const { control } = useFormContext<RavenSettings>()
    const autoCreate = useWatch({ control, name: "auto_create_department_channel" })

    // Every one of these settings drives something in Frappe HR — syncing employees,
    // reading leaves. Without the app installed they'd save happily and then do nothing,
    // so the tab stays visible and explains itself while the controls are held inert.
    const hrMissing = !isHRInstalled()

    return (
        <>
            {hrMissing && (
                <Alert theme="amber">
                    <AlertTriangleIcon />
                    <AlertTitle>{_("Frappe HR isn't installed")}</AlertTitle>
                    <AlertDescription>
                        {_("Install Frappe HR on this site to sync employees, departments and leaves with Raven.")}
                    </AlertDescription>
                </Alert>
            )}

            <SwitchFormField
                name="show_if_a_user_is_on_leave"
                label={_("Show if a user is on leave")}
                formDescription={_("Display a leave indicator on users who are off today.")}
                disabled={hrMissing}
            />

            <Separator />

            <SwitchFormField
                name="auto_create_department_channel"
                label={_("Create a channel for each department")}
                formDescription={_("A channel is created per department and employees are synced as members.")}
                disabled={hrMissing}
            />
            {autoCreate ? (
                <SelectFormField
                    name="department_channel_type"
                    label={_("Department channel type")}
                    disabled={hrMissing}
                >
                    <SelectItem value="Public">{_("Public")}</SelectItem>
                    <SelectItem value="Private">{_("Private")}</SelectItem>
                </SelectFormField>
            ) : null}
        </>
    )
}

/**
 * Frappe HR integration. Ported from v2's FrappeHR settings — department channel
 * sync + the on-leave indicator. The company↔workspace mapping table is managed
 * from the Frappe Desk for now.
 */
export const FrappeHR = () => (
    <AdminSettingsForm
        title={_("Frappe HR")}
        description={_("Connect your HR system to Raven to sync employee data and send notifications.")}
        formId={FORM_ID}
    >
        <FrappeHRFields />
    </AdminSettingsForm>
)

export default FrappeHR
