import { useEffect, useMemo, useRef, useState } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { GlobeIcon, MailIcon, PhoneIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@components/ui/dialog"
import { SelectItem } from "@components/ui/select"
import {
    CheckboxFormField, DataField, LinkFormField, SelectFormField, SmallTextField,
} from "@components/ui/form-elements"
import useDoctypeMetaDocs from "@hooks/useDoctypeMetaDocs"
import type { DocField } from "@raven/types/Core/DocField"
import _ from "@lib/translate"
import {
    type FieldData, FIELD_TYPES, FIELD_TYPE_ICONS, VALID_FIELD_TYPES, dataValidationFor, toActionType,
} from "./messageActionFieldUtils"

/** One dialog for both add and edit — a single FieldForm, no duplication. */
export const FieldDialog = ({
    doctype, field, usedFieldnames, onSubmit, children,
}: {
    doctype?: string
    field?: FieldData
    /** Fieldnames already in the table. These are hidden from the picker. */
    usedFieldnames: string[]
    onSubmit: (d: FieldData) => void
    children: React.ReactNode
}) => {
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{field ? _("Edit Field") : _("Add Field")}</DialogTitle>
                </DialogHeader>
                {open && (
                    <FieldForm
                        doctype={doctype}
                        field={field}
                        usedFieldnames={usedFieldnames}
                        submitLabel={field ? _("Save") : _("Add")}
                        onSubmit={(d) => { onSubmit(d); setOpen(false) }}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}

const FieldForm = ({
    doctype, field, usedFieldnames, submitLabel, onSubmit,
}: {
    doctype?: string
    field?: FieldData
    usedFieldnames: string[]
    submitLabel: string
    onSubmit: (d: FieldData) => void
}) => {
    const methods = useForm<FieldData>({ defaultValues: field ?? { default_value_type: "Static" } })
    const { control, setValue, handleSubmit } = methods

    // Fields already in the table cannot be picked again.
    // When editing, the row's own field stays available.
    const takenFieldnames = useMemo(
        () => usedFieldnames.filter((name) => name !== field?.fieldname),
        [usedFieldnames, field?.fieldname],
    )

    const type = useWatch({ control, name: "type" })
    const defaultValueType = useWatch({ control, name: "default_value_type" })

    // `options` means something different for each type: choices for Select,
    // a DocType for Link, a validation for Data. Clear it whenever the type changes.
    const prevType = useRef(type)
    useEffect(() => {
        if (prevType.current !== type) {
            setValue("options", "")
            prevType.current = type
        }
    }, [type, setValue])

    const onDoctypeFieldSelect = (df: DocField) => {
        if (df.label) setValue("label", df.label)
        if (df.description) setValue("helper_text", df.description)
        // Mark the type change as seen first, or the clear effect
        // above would wipe the options we set right after.
        const nextType = toActionType(df.fieldtype)
        prevType.current = nextType
        setValue("type", nextType)
        setValue("options", (df.fieldtype === "Data" ? dataValidationFor(df.options) : df.options) ?? "")
    }

    return (
        <FormProvider {...methods}>
            <div className="flex min-h-0 flex-1 flex-col gap-4">
                <DialogBody className="flex flex-col gap-4">
                    <div className="flex gap-3">
                        {doctype ? (
                            <div className="w-1/2">
                                <DoctypeFieldSelect doctype={doctype} exclude={takenFieldnames} onFieldSelect={onDoctypeFieldSelect} />
                            </div>
                        ) : (
                            <div className="w-1/2">
                                <DataField
                                    name="fieldname"
                                    label={_("Field Name")}
                                    isRequired
                                    rules={{
                                        required: _("Field is required"),
                                        validate: (v) => (takenFieldnames.includes(v ?? "") ? _("This field is already added") : true),
                                    }}
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
                                {FIELD_TYPES.map((t) => {
                                    const Icon = FIELD_TYPE_ICONS[t]
                                    return <SelectItem key={t} value={t}><Icon /> {t}</SelectItem>
                                })}
                            </SelectFormField>
                        </div>
                        {type === "Data" && (
                            <div className="w-1/2">
                                <SelectFormField
                                    name="options"
                                    label={_("Validation")}
                                    clearable
                                    placeholder={_("None")}
                                    formDescription={_("Optional. Checks the value is a valid email, phone number or URL.")}
                                >
                                    <SelectItem value="email"><MailIcon /> {_("Email")}</SelectItem>
                                    <SelectItem value="tel"><PhoneIcon /> {_("Phone")}</SelectItem>
                                    <SelectItem value="url"><GlobeIcon /> {_("URL")}</SelectItem>
                                </SelectFormField>
                            </div>
                        )}
                    </div>

                    <CheckboxFormField name="is_required" label={_("Required")} />

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
                </DialogBody>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" size="md">{_("Cancel")}</Button>
                    </DialogClose>
                    <Button type="button" size="md" onClick={handleSubmit(onSubmit)}>{submitLabel}</Button>
                </DialogFooter>
            </div>
        </FormProvider>
    )
}

/** Select over the target DocType's fields. Picking one fills in the rest of the form. */
const DoctypeFieldSelect = ({
    doctype, exclude, onFieldSelect,
}: { doctype: string; exclude: string[]; onFieldSelect: (field: DocField) => void }) => {
    const { doc: meta } = useDoctypeMetaDocs(doctype)
    const fields = useMemo(
        () => meta?.fields?.filter((f) =>
            f.fieldtype && VALID_FIELD_TYPES.includes(f.fieldtype) && !exclude.includes(f.fieldname ?? ""),
        ) ?? [],
        [meta, exclude],
    )

    return (
        <SelectFormField
            name="fieldname"
            label={_("Field")}
            isRequired
            placeholder={_("Select Field")}
            rules={{
                required: _("Field is required"),
                onChange: (event) => {
                    const df = fields.find((f) => f.fieldname === event.target.value)
                    if (df) onFieldSelect(df)
                },
            }}
        >
            {fields.map((f) => (
                <SelectItem key={f.fieldname} value={f.fieldname ?? ""}>
                    {f.label} <span className="text-ink-gray-5">({f.fieldname})</span>
                </SelectItem>
            ))}
        </SelectFormField>
    )
}

export default FieldDialog
