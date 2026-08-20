import { useFormContext, useWatch } from "react-hook-form"
import { Separator } from "@components/ui/separator"
import { SelectItem } from "@components/ui/select"
import {
    DataField, SelectFormField, SmallTextField, SwitchFormField, LinkFormField,
} from "@components/ui/form-elements"
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import _ from "@lib/translate"
import { DoctypeVariables } from "./DoctypeVariables"

/** Details tab — name, trigger, target doctype, sender bot, flags and the message body. */
export const DocumentNotificationDetailsTab = ({ isEdit }: { isEdit: boolean }) => {
    const { control } = useFormContext<RavenDocumentNotification>()
    const documentType = useWatch({ control, name: "document_type" })

    return (
        <div className="flex flex-col gap-5 w-full">
            <div className="grid grid-cols-2 gap-4">
                <DataField
                    name="notification_name"
                    label={_("Name")}
                    isRequired
                    disabled={isEdit}
                    inputProps={{ placeholder: _("Salary Slip Notification") }}
                    rules={{ required: _("Name is required") }}
                />
                <SelectFormField
                    name="send_alert_on"
                    label={_("Send Alert On")}
                    isRequired
                    rules={{ required: _("Trigger is required") }}
                >
                    <SelectItem value="New Document">{_("New Document")}</SelectItem>
                    <SelectItem value="Update">{_("Update")}</SelectItem>
                    <SelectItem value="Submit">{_("Submit")}</SelectItem>
                    <SelectItem value="Cancel">{_("Cancel")}</SelectItem>
                    <SelectItem value="Delete">{_("Delete")}</SelectItem>
                </SelectFormField>
                <LinkFormField
                    name="document_type"
                    label={_("Document Type")}
                    isRequired
                    doctype="DocType"
                    filters={[["istable", "=", 0], ["issingle", "=", 0]]}
                    rules={{ required: _("Document Type is required") }}
                    formDescription={_("The document type to send the notification for.")}
                />
                <LinkFormField
                    name="sender"
                    label={_("Sender")}
                    isRequired
                    doctype="Raven Bot"
                    rules={{ required: _("Sender is required") }}
                    formDescription={_("Notifications are sent via bots. Select the bot to send the notification.")}
                />
            </div>

            <div className="flex flex-col gap-3">
                <SwitchFormField name="enabled" label={_("Enabled")} />
                <SwitchFormField
                    name="do_not_attach_doc"
                    label={_("Hide document preview in the notification message")}
                    formDescription={_("If checked, the document preview will not be attached to the notification message.")}
                />
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
                <SmallTextField
                    name="message"
                    label={_("Message Content")}
                    inputProps={{ className: "min-h-[100px]", placeholder: "Hi {{ doc.employee_name }}, your salary slip is ready." }}
                    formDescription={_("The message to send. Use Jinja tags to embed document data, e.g. {{ doc.employee_name }}")}
                />
                <p className="text-p-sm text-ink-gray-5">
                    {_("You can also use functions like")}{" "}
                    <code className="text-ink-gray-7">{"{{ frappe.utils.today() }}"}</code>{" — "}
                    <a
                        href="https://docs.frappe.io/framework/user/en/api/jinja"
                        target="_blank" rel="noreferrer"
                        className="underline underline-offset-2 hover:text-ink-gray-8"
                    >
                        {_("see Frappe's Jinja documentation")}
                    </a>
                </p>
            </div>

            {documentType && <DoctypeVariables doctype={documentType} />}
        </div>
    )
}

export default DocumentNotificationDetailsTab
