import { useMemo, useState } from "react"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import {
    Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@components/ui/select"
import { LinkFormField } from "@components/ui/form-elements"
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
    const { register, control, setValue, handleSubmit, formState: { errors } } = methods

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
                        <div className="flex flex-col gap-1.5 w-1/2">
                            <Label htmlFor="fieldname">{_("Field Name")} <span className="text-ink-red-3">*</span></Label>
                            <Input id="fieldname" {...register("fieldname", { required: _("Field is required") })} />
                            {errors.fieldname && <p className="text-p-sm text-ink-red-3">{errors.fieldname.message}</p>}
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5 w-1/2">
                        <Label htmlFor="label">{_("Label")} <span className="text-ink-red-3">*</span></Label>
                        <Input id="label" {...register("label", { required: _("Label is required") })} />
                        {errors.label && <p className="text-p-sm text-ink-red-3">{errors.label.message}</p>}
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 w-1/2">
                        <Label>{_("Type")} <span className="text-ink-red-3">*</span></Label>
                        <Controller
                            control={control}
                            name="type"
                            rules={{ required: _("Type is required") }}
                            render={({ field: f }) => (
                                <Select value={f.value} onValueChange={f.onChange}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder={_("Select a type")} /></SelectTrigger>
                                    <SelectContent>
                                        {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.type && <p className="text-p-sm text-ink-red-3">{errors.type.message}</p>}
                    </div>
                    {type === "Data" && (
                        <div className="flex flex-col gap-1.5 w-1/2">
                            <Label htmlFor="options">{_("Validation")} <span className="text-p-sm text-ink-gray-5">({_("optional")})</span></Label>
                            <Input id="options" placeholder='email, tel, or url' {...register("options")} />
                        </div>
                    )}
                </div>

                <Controller
                    control={control}
                    name="is_required"
                    render={({ field: f }) => (
                        <label className="flex items-center gap-2 text-p-base text-ink-gray-8">
                            <Switch checked={!!f.value} onCheckedChange={(v) => f.onChange(v ? 1 : 0)} />
                            {_("Required")}
                        </label>
                    )}
                />

                {type === "Select" && (
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="select-options">{_("Options")}</Label>
                        <Textarea
                            id="select-options"
                            className="min-h-[100px]"
                            placeholder={_("Add options on new lines")}
                            {...register("options", { required: type === "Select" ? _("Options are required") : false })}
                        />
                        {errors.options && <p className="text-p-sm text-ink-red-3">{errors.options.message}</p>}
                    </div>
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

                <div className="flex flex-col gap-1.5">
                    <Label>{_("Default Value Type")}</Label>
                    <Controller
                        control={control}
                        name="default_value_type"
                        render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                                <SelectTrigger className="w-full"><SelectValue placeholder={_("Select a default value type")} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Static">{_("Static")}</SelectItem>
                                    <SelectItem value="Message Field">{_("Message Field")}</SelectItem>
                                    <SelectItem value="Jinja">{_("Jinja")}</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <p className="text-p-sm text-ink-gray-5">
                        {_("Static value, a field from the selected message, or a Jinja template with the message as context.")}
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>{_("Default Value")}</Label>
                    {defaultValueType === "Message Field" ? (
                        <Controller
                            control={control}
                            name="default_value"
                            render={({ field: f }) => (
                                <Select value={f.value} onValueChange={f.onChange}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder={_("Select a message field")} /></SelectTrigger>
                                    <SelectContent>
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
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    ) : defaultValueType === "Jinja" ? (
                        <Textarea
                            className="min-h-[100px]"
                            placeholder="{{ message.content }}"
                            {...register("default_value")}
                        />
                    ) : (
                        <Input {...register("default_value")} />
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="helper_text">{_("Description")} <span className="text-p-sm text-ink-gray-5">({_("optional")})</span></Label>
                    <Input id="helper_text" {...register("helper_text")} />
                </div>

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
