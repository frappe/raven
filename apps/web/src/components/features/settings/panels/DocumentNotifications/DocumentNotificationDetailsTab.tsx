import { Controller, useFormContext, useWatch } from "react-hook-form"
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import { Separator } from "@components/ui/separator"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@components/ui/select"
import { LinkFormField } from "@components/ui/form-elements"
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import _ from "@lib/translate"
import { DoctypeVariables } from "./DoctypeVariables"

const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-p-sm text-ink-red-3">{message}</p> : null

const FieldHelp = ({ children }: { children: React.ReactNode }) => (
    <p className="text-p-sm text-ink-gray-5">{children}</p>
)

/** Details tab — name, trigger, target doctype, sender bot, flags and the message body. */
export const DocumentNotificationDetailsTab = ({ isEdit }: { isEdit: boolean }) => {
    const { register, control, formState: { errors } } = useFormContext<RavenDocumentNotification>()
    const documentType = useWatch({ control, name: "document_type" })

    return (
        <div className="flex flex-col gap-5 w-full">
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="notification_name">{_("Name")} <span className="text-ink-red-3">*</span></Label>
                    <Input
                        id="notification_name"
                        disabled={isEdit}
                        placeholder={_("Salary Slip Notification")}
                        {...register("notification_name", { required: _("Name is required") })}
                    />
                    <FieldError message={errors.notification_name?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label>{_("Send Alert On")} <span className="text-ink-red-3">*</span></Label>
                    <Controller
                        control={control}
                        name="send_alert_on"
                        rules={{ required: _("Trigger is required") }}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full"><SelectValue placeholder={_("Pick a trigger")} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="New Document">{_("New Document")}</SelectItem>
                                    <SelectItem value="Update">{_("Update")}</SelectItem>
                                    <SelectItem value="Submit">{_("Submit")}</SelectItem>
                                    <SelectItem value="Cancel">{_("Cancel")}</SelectItem>
                                    <SelectItem value="Delete">{_("Delete")}</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <FieldError message={errors.send_alert_on?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <LinkFormField
                        name="document_type"
                        label={_("Document Type")}
                        isRequired
                        doctype="DocType"
                        filters={[["istable", "=", 0], ["issingle", "=", 0]]}
                        rules={{ required: _("Document Type is required") }}
                    />
                    <FieldHelp>{_("The document type to send the notification for.")}</FieldHelp>
                </div>
                <div className="flex flex-col gap-1.5">
                    <LinkFormField
                        name="sender"
                        label={_("Sender")}
                        isRequired
                        doctype="Raven Bot"
                        rules={{ required: _("Sender is required") }}
                    />
                    <FieldHelp>{_("Notifications are sent via bots. Select the bot to send the notification.")}</FieldHelp>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <Controller
                    control={control}
                    name="enabled"
                    render={({ field }) => (
                        <label className="flex items-center gap-2 text-p-base text-ink-gray-8">
                            <Switch checked={!!field.value} onCheckedChange={(v) => field.onChange(v ? 1 : 0)} />
                            {_("Enabled")}
                        </label>
                    )}
                />
                <Controller
                    control={control}
                    name="do_not_attach_doc"
                    render={({ field }) => (
                        <label className="flex items-start gap-2 text-p-base text-ink-gray-8">
                            <Switch checked={!!field.value} onCheckedChange={(v) => field.onChange(v ? 1 : 0)} />
                            <span className="flex flex-col gap-0.5">
                                {_("Hide document preview in the notification message")}
                                <FieldHelp>{_("If checked, the document preview will not be attached to the notification message.")}</FieldHelp>
                            </span>
                        </label>
                    )}
                />
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="message">{_("Message Content")}</Label>
                <Textarea
                    id="message"
                    rows={8}
                    placeholder="Hi {{ doc.employee_name }}, your salary slip is ready."
                    {...register("message")}
                />
                <FieldHelp>
                    {_("The message to send. Use Jinja tags to embed document data, e.g.")} <code className="text-ink-gray-7">{"{{ doc.employee_name }}"}</code>.
                </FieldHelp>
            </div>

            {documentType && <DoctypeVariables doctype={documentType} />}
        </div>
    )
}

export default DocumentNotificationDetailsTab
