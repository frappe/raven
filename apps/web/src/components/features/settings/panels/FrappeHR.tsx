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

/**
 * Frappe HR integration. Ported from v2's FrappeHR settings — department channel
 * sync + the on-leave indicator. The company↔workspace mapping table is managed
 * from the Frappe Desk for now.
 */
export const FrappeHR = () => (
    <AdminSettingsForm<RavenSettings>
        title={_("Frappe HR")}
        description={_("Connect your HR system to Raven to sync employee data and send notifications.")}
        formId={FORM_ID}
    >
        {(form) => {
            const autoCreate = form.watch("auto_create_department_channel")
            return (
                <>
                    {!isHRInstalled() && (
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
                    />

                    <Separator />

                    <SwitchFormField
                        name="auto_create_department_channel"
                        label={_("Create a channel for each department")}
                        formDescription={_("A channel is created per department and employees are synced as members.")}
                    />
                    {autoCreate ? (
                        <SelectFormField
                            name="department_channel_type"
                            label={_("Department channel type")}
                        >
                            <SelectItem value="Public">{_("Public")}</SelectItem>
                            <SelectItem value="Private">{_("Private")}</SelectItem>
                        </SelectFormField>
                    ) : null}
                </>
            )
        }}
    </AdminSettingsForm>
)

export default FrappeHR
