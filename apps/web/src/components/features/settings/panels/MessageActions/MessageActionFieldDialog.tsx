import { useMemo, useState } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { Button } from "@components/ui/button"
import { Label } from "@components/ui/label"
import {
    Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@components/ui/select"
import {
    DataField, LinkFormField, SelectFormField, SmallTextField, SwitchFormField,
} from "@components/ui/form-elements"
import useDoctypeMeta from "@hooks/useDoctypeMeta"
import type { DocField } from "@raven/types/Core/DocField"
import _ from "@lib/translate"
import {
    type FieldData, FIELD_TYPES, VALID_FIELD_TYPES, dataValidationFor, toActionType,
} from "./messageActionFieldUtils"

/** One dialog for both add and edit — a single FieldForm, no duplication. */
export const FieldDialog = ({
    doctype, field, onSubmit, children,
}: {
    doctype?: string
    field?: FieldData
    onSubmit: (d: FieldData) => void
    children: React.ReactNode
}) => {
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{field ? _("Edit Field") : _("Add Field")}</DialogTitle>
                </DialogHeader>
                {open && (
                    <FieldForm
                        doctype={doctype}
                        field={field}
                        submitLabel={field ? _("Save") : _("Add")}
                        onSubmit={(d) => { onSubmit(d); setOpen(false) }}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}

const FieldForm = ({
    doctype, field, submitLabel, onSubmit,
}: {
    doctype?: string
    field?: FieldData
    submitLabel: string
    onSubmit: (d: FieldData) => void
}) => {
    const methods = useForm<FieldData>({ defaultValues: field ?? { default_value_type: "Static" } })
    const { control, setValue, handleSubmit } = methods

    const fieldname = useWatch({ control, name: "fieldname" })
    const type = useWatch({ control, name: "type" })
    const defaultValueType = useWatch({ control, name: "default_value_type" })

    const onDoctypeFieldSelect = (df: DocField) => {
        setValue("fieldname", df.fieldname ?? "")
        if (df.label) setValue("label", df.label)
        if (df.description) setValue("helper_text", df.description)
        if (df.fieldtype) setValue("type", toActionType(df.fieldtype))
        if (df.options) setValue("options", df.fieldtype === "Data" ? dataValidationFor(df.options) : df.options)
    }

    return (
        <FormProvider {...methods}>
            <div className="flex flex-col gap-4">
                <div className="flex gap-3">
                    {doctype ? (
                        <div className="flex flex-col gap-1.5 w-1/2">
                            <Label>{_("Field")} <span className="text-ink-red-3">*</span></Label>
                            <DoctypeFieldSelect doctype={doctype} value={fieldname ?? ""} onFieldSelect={onDoctypeFieldSelect} />
                        </div>
                    ) : (
                        <div className="w-1/2">
                            <DataField
                                name="fieldname"
                                label={_("Field Name")}
                                isRequired
                                rules={{ required: _("Field is required") }}
                            />
                        </div>
                    )}
                    <div className="w-1/2">
                        <DataField
                            name="label"
                            label={_("Label")}
                            isRequired
                            rules={{ required: _("Label is required") }}
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="w-1/2">
                        <SelectFormField
                            name="type"
                            label={_("Type")}
                            isRequired
                            rules={{ required: _("Type is required") }}
                        >
                            {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectFormField>
                    </div>
                    {type === "Data" && (
                        <div className="w-1/2">
                            <DataField
                                name="options"
                                label={_("Validation")}
                                formDescription={_("Optional — email, tel, or url")}
                                inputProps={{ placeholder: "email, tel, or url" }}
                            />
                        </div>
                    )}
                </div>

                <SwitchFormField name="is_required" label={_("Required")} />

                {type === "Select" && (
                    <SmallTextField
                        name="options"
                        label={_("Options")}
                        inputProps={{ className: "min-h-[100px]", placeholder: _("Add options on new lines") }}
                        rules={{ required: type === "Select" ? _("Options are required") : false }}
                    />
                )}

                {type === "Link" && (
                    <LinkFormField
                        name="options"
                        label={_("Document Type")}
                        isRequired
                        doctype="DocType"
                        filters={[["istable", "=", 0], ["issingle", "=", 0]]}
                        rules={{ required: type === "Link" ? _("Document Type is required") : false }}
                    />
                )}

                <SelectFormField
                    name="default_value_type"
                    label={_("Default Value Type")}
                    formDescription={_("Static value, a field from the selected message, or a Jinja template with the message as context.")}
                >
                    <SelectItem value="Static">{_("Static")}</SelectItem>
                    <SelectItem value="Message Field">{_("Message Field")}</SelectItem>
                    <SelectItem value="Jinja">{_("Jinja")}</SelectItem>
                </SelectFormField>

                {defaultValueType === "Message Field" ? (
                    <SelectFormField name="default_value" label={_("Default Value")}>
                        <SelectItem value="text">{_("Text (with HTML)")}</SelectItem>
                        <SelectItem value="content">{_("Content (plain text)")}</SelectItem>
                        <SelectItem value="file">{_("File")}</SelectItem>
                        <SelectItem value="owner">{_("Owner")}</SelectItem>
                        <SelectItem value="creation">{_("Creation")}</SelectItem>
                        <SelectItem value="message_type">{_("Message Type")}</SelectItem>
                        <SelectItem value="link_doctype">{_("Linked DocType")}</SelectItem>
                        <SelectItem value="link_document">{_("Linked Document")}</SelectItem>
                        <SelectItem value="channel_id">{_("Channel ID")}</SelectItem>
                        <SelectItem value="workspace_id">{_("Workspace ID")}</SelectItem>
                        <SelectItem value="message_url">{_("Message URL")}</SelectItem>
                    </SelectFormField>
                ) : defaultValueType === "Jinja" ? (
                    <SmallTextField
                        name="default_value"
                        label={_("Default Value")}
                        inputProps={{ className: "min-h-[100px]", placeholder: "{{ message.content }}" }}
                    />
                ) : (
                    <DataField name="default_value" label={_("Default Value")} />
                )}

                <DataField
                    name="helper_text"
                    label={_("Description")}
                    formDescription={_("Optional")}
                />

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">{_("Cancel")}</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSubmit(onSubmit)}>{submitLabel}</Button>
                </DialogFooter>
            </div>
        </FormProvider>
    )
}

/** A Select over a target DocType's fields; picking one auto-fills the field form. */
const DoctypeFieldSelect = ({
    doctype, value, onFieldSelect,
}: { doctype: string; value: string; onFieldSelect: (field: DocField) => void }) => {
    const { doc: meta } = useDoctypeMeta(doctype)
    const fields = useMemo(
        () => meta?.fields?.filter((f) => f.fieldtype && VALID_FIELD_TYPES.includes(f.fieldtype)) ?? [],
        [meta],
    )

    return (
        <Select
            value={value}
            onValueChange={(v) => { const df = fields.find((f) => f.fieldname === v); if (df) onFieldSelect(df) }}
        >
            <SelectTrigger className="w-full"><SelectValue placeholder={_("Select Field")} /></SelectTrigger>
            <SelectContent>
                {fields.map((f) => (
                    <SelectItem key={f.fieldname} value={f.fieldname ?? ""}>
                        {f.label} <span className="text-ink-gray-5">({f.fieldname})</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export default FieldDialog
