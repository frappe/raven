import { useMemo } from "react"
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@components/ui/table"
import LinkFieldCombobox from "@components/common/LinkFieldComboBox/LinkFieldCombobox"
import useDoctypeMeta from "@hooks/useDoctypeMeta"
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import type { RavenDocumentNotificationRecipients } from "@raven/types/RavenIntegrations/RavenDocumentNotificationRecipients"
import type { DocField } from "@raven/types/Core/DocField"
import _ from "@lib/translate"

/** Recipients tab — who receives the notification (channels/users), resolved
 *  statically, from a document field, or via a Jinja expression. */
export const DocumentNotificationRecipientsTab = () => {
    const { control } = useFormContext<RavenDocumentNotification>()
    const { fields, append, remove } = useFieldArray({ control, name: "recipients" })

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <p className="text-p-sm text-ink-gray-5 max-w-lg">
                    {_("Recipients are the users who will receive the notification. Send to channels or specific users.")}
                </p>
                <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => append({ channel_type: "Channel", variable_type: "Static", value: "" } as RavenDocumentNotificationRecipients)}
                >
                    <PlusIcon />
                    {_("Add Recipient")}
                </Button>
            </div>

            {fields.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-48">{_("Channel Type")}</TableHead>
                            <TableHead className="w-44">{_("Variable Type")}</TableHead>
                            <TableHead>{_("Value")} <span className="text-ink-red-3">*</span></TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((row, index) => (
                            <RecipientRow key={row.id} index={index} onRemove={() => remove(index)} />
                        ))}
                    </TableBody>
                </Table>
            )}

            <p className="text-p-sm text-ink-gray-5">
                {_("You can use Jinja to resolve a recipient — e.g.")}{" "}
                <code className="text-ink-gray-7">{`{{ frappe.db.get_value('Employee', doc.employee_id, 'user') }}`}</code>
            </p>
        </div>
    )
}

const RecipientRow = ({ index, onRemove }: { index: number; onRemove: () => void }) => {
    const { control } = useFormContext<RavenDocumentNotification>()

    return (
        <TableRow>
            <TableCell>
                <Controller
                    control={control}
                    name={`recipients.${index}.channel_type`}
                    rules={{ required: true }}
                    render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Channel">{_("Channel")}</SelectItem>
                                <SelectItem value="User">{_("Direct Message")}</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </TableCell>
            <TableCell>
                <Controller
                    control={control}
                    name={`recipients.${index}.variable_type`}
                    render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Static">{_("Static")}</SelectItem>
                                <SelectItem value="DocField">{_("Document Field")}</SelectItem>
                                <SelectItem value="Jinja">{_("Jinja")}</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </TableCell>
            <TableCell>
                <Controller
                    control={control}
                    name={`recipients.${index}.value`}
                    rules={{ required: _("Value is required") }}
                    render={({ field, fieldState }) => (
                        <>
                            <RecipientValueField index={index} value={field.value ?? ""} onChange={field.onChange} />
                            {fieldState.error && <p className="mt-1.5 text-p-sm text-ink-red-3">{fieldState.error.message}</p>}
                        </>
                    )}
                />
            </TableCell>
            <TableCell>
                <Button
                    type="button" variant="ghost" theme="red" size="sm" isIconButton
                    aria-label={_("Remove recipient")} onClick={onRemove}
                >
                    <Trash2Icon />
                </Button>
            </TableCell>
        </TableRow>
    )
}

const RecipientValueField = ({
    index, value, onChange,
}: { index: number; value: string; onChange: (v: string) => void }) => {
    const { control } = useFormContext<RavenDocumentNotification>()
    const variableType = useWatch({ control, name: `recipients.${index}.variable_type` })
    const channelType = useWatch({ control, name: `recipients.${index}.channel_type` })
    const documentType = useWatch({ control, name: "document_type" })

    if (variableType === "Static") {
        return channelType === "Channel" ? (
            <LinkFieldCombobox
                doctype="Raven Channel"
                filters={[["is_direct_message", "=", 0], ["is_archived", "=", 0], ["is_thread", "=", 0]]}
                placeholder={_("Select a channel")}
                value={value}
                onChange={onChange}
            />
        ) : (
            <LinkFieldCombobox
                doctype="Raven User"
                filters={[["enabled", "=", 1], ["type", "=", "User"]]}
                placeholder={_("Select a user")}
                value={value}
                onChange={onChange}
            />
        )
    }

    if (variableType === "DocField" && documentType) {
        return <DoctypeFieldSelect documentType={documentType} channelType={channelType} value={value} onChange={onChange} />
    }

    return (
        <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='{{ frappe.db.get_value("Employee", doc.employee_id, "user_id") }}'
        />
    )
}

/** Field picker for DocField recipients — suggests fields that link to the right target. */
const DoctypeFieldSelect = ({
    documentType, channelType, value, onChange,
}: { documentType: string; channelType: "Channel" | "User"; value: string; onChange: (v: string) => void }) => {
    const { doc } = useDoctypeMeta(documentType)

    const { suggested, all } = useMemo(() => {
        const suggested: DocField[] = []
        const all: DocField[] = []
        const isTarget = (f: DocField) => {
            if (f.fieldtype !== "Link" || !f.options) return false
            return channelType === "Channel"
                ? f.options.includes("Raven Channel")
                : f.options.includes("Raven User") || f.options.includes("User")
        }
        doc?.fields?.forEach((f) => {
            if (!f.fieldname) return
            ;(isTarget(f) ? suggested : all).push(f)
        })
        const ownerFields: DocField[] = [
            { fieldname: "owner", label: "Owner", fieldtype: "Link", options: "User" } as DocField,
            { fieldname: "modified_by", label: "Modified By", fieldtype: "Link", options: "User" } as DocField,
        ]
        ;(channelType === "User" ? suggested : all).push(...ownerFields)
        return { suggested, all }
    }, [doc, channelType])

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full"><SelectValue placeholder={_("Pick a field")} /></SelectTrigger>
            <SelectContent>
                {suggested.length > 0 && (
                    <SelectGroup>
                        <SelectLabel>{_("Suggested")}</SelectLabel>
                        {suggested.map((f) => (
                            <SelectItem key={f.fieldname} value={f.fieldname ?? ""}>{f.label} ({f.fieldname})</SelectItem>
                        ))}
                    </SelectGroup>
                )}
                <SelectGroup>
                    <SelectLabel>{_("All")}</SelectLabel>
                    {all.map((f) => (
                        <SelectItem key={f.fieldname} value={f.fieldname ?? ""}>{f.label} ({f.fieldname})</SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}

export default DocumentNotificationRecipientsTab
