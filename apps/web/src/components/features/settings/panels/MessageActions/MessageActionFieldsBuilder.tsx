import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import useDoctypeMeta from "@hooks/useDoctypeMeta"
import type { MessageActionFormData } from "./types"
import type { RavenMessageActionFields } from "@raven/types/RavenIntegrations/RavenMessageActionFields"
import _ from "@lib/translate"
import { type FieldData, dataValidationFor, toActionType } from "./messageActionFieldUtils"
import { FieldDialog } from "./MessageActionFieldDialog"

/** Fields tab — build the dialog fields the action collects, manually or imported from the target DocType. */
export const MessageActionFieldsBuilder = () => {
    const { control } = useFormContext<MessageActionFormData>()
    const { fields, append, remove, update } = useFieldArray({ control, name: "fields" })
    const action = useWatch({ control, name: "action" })
    const doctype = useWatch({ control, name: "document_type" })

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <p className="text-p-sm text-ink-gray-5 max-w-lg">{_("Fields to collect from the user when this action runs.")}</p>
                <div className="flex items-center gap-2">
                    {action === "Create Document" && doctype && (
                        <ImportFromDoctype doctype={doctype} append={(d) => append(d as RavenMessageActionFields)} />
                    )}
                    <FieldDialog doctype={doctype} onSubmit={(d) => append(d as RavenMessageActionFields)}>
                        <Button type="button" variant="outline" size="sm"><PlusIcon />{_("Add Field")}</Button>
                    </FieldDialog>
                </div>
            </div>

            {fields.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{_("Label")}</TableHead>
                            <TableHead>{_("Fieldname")}</TableHead>
                            <TableHead>{_("Required")}</TableHead>
                            <TableHead>{_("Options")}</TableHead>
                            <TableHead>{_("Default Value")}</TableHead>
                            <TableHead className="w-20" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                            <TableRow key={field.id}>
                                <TableCell>
                                    <span className="text-base-medium text-ink-gray-8">{field.label}</span>
                                    <Badge variant="subtle" className="ml-2">{field.type}</Badge>
                                </TableCell>
                                <TableCell><code className="text-p-sm text-ink-gray-6">{field.fieldname}</code></TableCell>
                                <TableCell>{field.is_required ? _("Yes") : "—"}</TableCell>
                                <TableCell>
                                    {field.options ? (
                                        field.type === "Select" ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge variant="subtle">
                                                        {_("{0} Options", [String(field.options.split("\n").length)])}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>{field.options.split("\n").join(", ")}</TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <Badge variant="outline">{field.options}</Badge>
                                        )
                                    ) : "—"}
                                </TableCell>
                                <TableCell className="text-ink-gray-6">{field.default_value || "—"}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <FieldDialog
                                            doctype={doctype}
                                            field={field}
                                            onSubmit={(d) => update(index, d as RavenMessageActionFields)}
                                        >
                                            <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("Edit field")}>
                                                <PencilIcon className="text-ink-gray-6" />
                                            </Button>
                                        </FieldDialog>
                                        <Button
                                            type="button" variant="ghost" theme="red" size="sm" isIconButton
                                            aria-label={_("Remove field")} onClick={() => remove(index)}
                                        >
                                            <Trash2Icon />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}

/** Bulk-add the target DocType's required fields as action fields. */
const ImportFromDoctype = ({ doctype, append }: { doctype: string; append: (d: FieldData) => void }) => {
    const { getValues } = useFormContext<MessageActionFormData>()
    const { doc: meta } = useDoctypeMeta(doctype)

    const importFields = () => {
        const existing = (getValues("fields") || []).map((f) => f.fieldname)
        meta?.fields
            ?.filter((f) => f.reqd && f.fieldtype !== "Table" && f.fieldtype !== "Table MultiSelect")
            ?.filter((f) => !existing.includes(f.fieldname ?? ""))
            ?.forEach((f) => append({
                fieldname: f.fieldname,
                label: f.label,
                helper_text: f.description,
                type: toActionType(f.fieldtype),
                is_required: f.reqd,
                options: f.fieldtype === "Data" ? dataValidationFor(f.options) : f.options,
                default_value_type: "Static",
                default_value: f.default,
            }))
    }

    return (
        <Button type="button" variant="outline" size="sm" onClick={importFields}>
            {_("Import fields from {0}", [doctype])}
        </Button>
    )
}

export default MessageActionFieldsBuilder
