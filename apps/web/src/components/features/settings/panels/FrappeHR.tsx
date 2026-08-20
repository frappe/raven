import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Separator } from "@components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import { LinkFormField, SelectFormField, SwitchFormField } from "@components/ui/form-elements"
import { SelectItem } from "@components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@components/ui/table"
import { WorkspaceSelect } from "@components/common/WorkspaceSelect"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { AdminSettingsForm } from "./AdminSettingsForm"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"
import type { RavenHRCompanyWorkspace } from "@raven/types/RavenIntegrations/RavenHRCompanyWorkspace"
import { AlertTriangleIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
                <>
                    <SelectFormField
                        name="department_channel_type"
                        label={_("Department channel type")}
                        disabled={hrMissing}
                    >
                        <SelectItem value="Public">{_("Public")}</SelectItem>
                        <SelectItem value="Private">{_("Private")}</SelectItem>
                    </SelectFormField>
                    <CompanyWorkspaceMapping disabled={hrMissing} />
                </>
            ) : null}
        </>
    )
}

/** Which workspace each company's department channels are created in. */
const CompanyWorkspaceMapping = ({ disabled }: { disabled: boolean }) => {
    const { control, formState } = useFormContext<RavenSettings>()
    const { fields, append, remove } = useFieldArray({ control, name: "company_workspace_mapping" })
    const { workspaces } = useWorkspaces()
    const inert = disabled || formState.disabled

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-base-medium text-ink-gray-8">{_("Choose workspaces based on companies")}</span>
                <Button
                    type="button" variant="outline" size="sm" disabled={inert}
                    onClick={() => append({ company: "", raven_workspace: "" } as RavenHRCompanyWorkspace)}
                >
                    <PlusIcon />
                    {_("Add")}
                </Button>
            </div>
            {fields.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{_("Company")}</TableHead>
                            <TableHead>{_("Workspace")}</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((row, index) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <LinkFormField
                                        name={`company_workspace_mapping.${index}.company`}
                                        label={_("Company in Row {0}", [String(index + 1)])}
                                        hideLabel
                                        doctype="Company"
                                        disabled={inert}
                                        rules={{ required: _("Company is required") }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Controller
                                        control={control}
                                        name={`company_workspace_mapping.${index}.raven_workspace`}
                                        rules={{ required: _("Workspace is required") }}
                                        render={({ field, fieldState }) => (
                                            <>
                                                <WorkspaceSelect
                                                    value={field.value ?? ""}
                                                    onValueChange={field.onChange}
                                                    workspaces={workspaces}
                                                    disabled={inert}
                                                    className="w-full"
                                                />
                                                {fieldState.error && <p className="mt-1.5 text-p-sm text-ink-red-3">{fieldState.error.message}</p>}
                                            </>
                                        )}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Button
                                        type="button" variant="ghost" theme="red" size="sm" isIconButton
                                        aria-label={_("Remove mapping")} disabled={inert}
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2Icon />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}

/**
 * Frappe HR integration. Ported from v2's FrappeHR settings — department channel
 * sync, the company↔workspace mapping and the on-leave indicator.
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
