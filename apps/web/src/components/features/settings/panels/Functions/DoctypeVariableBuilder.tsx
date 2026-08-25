import { useMemo, useState } from "react"
import { useFieldArray, useFormContext, useWatch, type UseFieldArrayUpdate } from "react-hook-form"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@components/ui/dialog"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useDoctypeMetaDocs } from "@hooks/useDoctypeMetaDocs"
import { FieldTypeBadge } from "../ai/fieldTypeBadge"
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import type { RavenAIFunctionParams } from "@raven/types/RavenAI/RavenAIFunctionParams"
import { getFieldInfoFromDocField, inList, TABLE_FIELD_TYPES, VARIABLE_FUNCTION_TYPES } from "./variableFieldMapping"
import DoctypeVariableDialogForm from "./DoctypeVariableDialogForm"

type VariableData = Partial<RavenAIFunctionParams>

/** Builds the `parameters` field-array of a Create/Update document function — imports doctype fields, and adds/edits/removes variables. */
const DoctypeVariableBuilder = () => {


    const type = useWatch<RavenAIFunction>({ name: "type" })
    const doctype = useWatch<RavenAIFunction>({ name: "reference_doctype" })

    if (inList(VARIABLE_FUNCTION_TYPES, type) && doctype) {
        return <VariableList doctype={doctype} />
    }

    return null
}

export default DoctypeVariableBuilder

const VariableList = ({ doctype }: { doctype: string }) => {
    const { control } = useFormContext<RavenAIFunction>()

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: "parameters",
    })

    const addField = (data: VariableData) => {
        append(data as RavenAIFunctionParams)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end gap-2">
                <ImportDoctypeVariables doctype={doctype} append={addField} />
                <AddDoctypeVariableDialog onAdd={addField} doctype={doctype} />
            </div>
            <div className="flex flex-col gap-3">
                {fields.map((field, index) => (
                    <FieldRow
                        key={field.id}
                        field={field}
                        index={index}
                        update={update}
                        remove={remove}
                        doctype={doctype}
                    />
                ))}
            </div>
        </div>
    )
}

const FieldRow = ({ field, index, remove, doctype, update }: {
    field: RavenAIFunctionParams & { id: string }
    index: number
    remove: (index: number) => void
    doctype: string
    update: UseFieldArrayUpdate<RavenAIFunction, "parameters">
}) => {
    const { doc: doctypeMeta } = useDoctypeMetaDocs(doctype)

    const onEdit = (data: VariableData) => {
        update(index, data as RavenAIFunctionParams)
    }

    // Resolve the docfield of the child table (child_table_name) or of the field itself.
    const { options, type } = useMemo(() => {
        if (field.child_table_name) {
            const docfield = doctypeMeta?.fields?.find((f) => f.fieldname === field.child_table_name)
            return { options: docfield?.options, type: docfield?.fieldtype }
        }
        const docfield = doctypeMeta?.fields?.find((f) => f.fieldname === field.fieldname)
        return { options: docfield?.options, type: docfield?.fieldtype }
    }, [field.child_table_name, field.fieldname, doctypeMeta])

    const n = field.options ? field.options.split("\n").length : 0

    return (
        <div className={cn("rounded-md border border-outline-gray-2 p-3 md:p-2", field.do_not_ask_ai && "bg-surface-gray-3")}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold md:text-sm">{field.fieldname}</span>
                        <FieldTypeBadge type={field.type} />
                        {field.required ? <Badge variant="subtle" theme="red">{_("Required")}</Badge> : null}
                        {field.options ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="subtle" theme="blue">{n === 1 ? _("1 Option") : _("{0} Options", [String(n)])}</Badge>
                                </TooltipTrigger>
                                <TooltipContent>{field.options.split("\n").join(", ")}</TooltipContent>
                            </Tooltip>
                        ) : null}
                        {field.do_not_ask_ai ? <Badge variant="subtle" theme="gray">{_("Do not ask AI")}</Badge> : null}
                    </div>
                    <p className="text-base md:text-sm">{field.description}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {field.default_value ? <p className="text-sm text-ink-gray-6">{_("Default Value:")} {field.default_value}</p> : null}
                        {field.default_value && field.child_table_name ? <Separator orientation="vertical" className="h-4" /> : null}
                        {field.child_table_name && inList(TABLE_FIELD_TYPES, type) ? (
                            <p className="text-sm text-ink-gray-6">{_("Child Table:")} {options} ({field.child_table_name})</p>
                        ) : null}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <EditDoctypeVariableDialog onEdit={onEdit} field={field} doctype={doctype} />
                    <Button
                        type="button"
                        variant="ghost"
                        theme="red"
                        size="sm"
                        isIconButton
                        onClick={() => remove(index)}
                        aria-label={_("Remove")}
                    >
                        <Trash2Icon />
                    </Button>
                </div>
            </div>
        </div>
    )
}

const AddDoctypeVariableDialog = ({ onAdd, doctype }: { onAdd: (data: VariableData) => void, doctype: string }) => {
    const [open, setOpen] = useState(false)

    const onAddField = (data: VariableData) => {
        onAdd(data)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="subtle">{_("Add")}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogTitle>{_("Add Variable")}</DialogTitle>
                <DialogDescription className="sr-only">{_("Add a new variable in the function.")}</DialogDescription>
                <DoctypeVariableDialogForm doctype={doctype} onAdd={onAddField} />
            </DialogContent>
        </Dialog>
    )
}

const EditDoctypeVariableDialog = ({ onEdit, field, doctype }: {
    onEdit: (data: VariableData) => void
    field: RavenAIFunctionParams
    doctype: string
}) => {
    const [open, setOpen] = useState(false)

    const onEditField = (data: VariableData) => {
        onEdit(data)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("Edit")}>
                    <PencilIcon />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogTitle>{_("Edit Variable")}</DialogTitle>
                <DialogDescription className="sr-only">{_("Edit variable - {0} in the function.", [field.fieldname])}</DialogDescription>
                <DoctypeVariableDialogForm doctype={doctype} onAdd={onEditField} defaultValues={field} />
            </DialogContent>
        </Dialog>
    )
}

const ImportDoctypeVariables = ({ doctype, append }: { doctype: string, append: (data: VariableData) => void }) => {
    const { getValues } = useFormContext<RavenAIFunction>()

    const { doc: doctypeMeta, childDocs } = useDoctypeMetaDocs(doctype)

    const getRequiredFieldsForChildTable = (childTable: string, fieldname: string) => {
        const childTableMeta = childDocs?.find((d) => d.name === childTable)

        if (childTableMeta) {
            return childTableMeta.fields?.filter((f) => f.reqd).map((f) => ({
                ...getFieldInfoFromDocField(f, childTableMeta.name),
                child_table_name: fieldname,
            })) || []
        }

        return []
    }

    const importFields = () => {
        const fields = getValues("parameters") || []

        const requiredFields = doctypeMeta?.fields?.filter((f) => f.reqd)

        const nonTableFields = requiredFields?.filter((f) => f.fieldtype !== "Table" && f.fieldtype !== "Table MultiSelect")

        const existingFields = fields.map((f) => f.fieldname)

        const regularFieldsToBeAdded = nonTableFields?.filter((f) => !existingFields.includes(f.fieldname ?? "")).map((f) => getFieldInfoFromDocField(f)) || []

        const requiredTableFields = requiredFields?.filter((f) => f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect")

        const requiredTableFieldsFlattened = (requiredTableFields?.map((f) => getRequiredFieldsForChildTable(f.options ?? "", f.fieldname ?? "")) ?? []).flat()

        const tableFieldsToBeAdded = requiredTableFieldsFlattened?.filter((f) => {
            const exists = fields.some((field) => field.fieldname === f.fieldname && field.child_table_name === f.child_table_name)
            return !exists
        })

        const allFieldsToBeAdded = [...regularFieldsToBeAdded, ...tableFieldsToBeAdded]

        allFieldsToBeAdded?.forEach((field) => {
            append(field)
        })
    }

    return (
        <Button type="button" variant="outline" onClick={importFields}>
            {_("Import fields from {0}", [doctype])}
        </Button>
    )
}
