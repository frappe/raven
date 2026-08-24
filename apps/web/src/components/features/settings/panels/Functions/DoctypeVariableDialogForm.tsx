import { useContext, useState } from "react"
import { useForm, useFormContext, useWatch } from "react-hook-form"
import { FrappeConfig, FrappeContext, useFrappeGetCall, useSearch } from "frappe-react-sdk"
import { SearchIcon } from "lucide-react"
import _ from "@lib/translate"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { DialogClose, DialogFooter } from "@components/ui/dialog"
import { Form } from "@components/ui/form"
import { DataField, SelectFormField, SmallTextField, SwitchFormField } from "@components/ui/form-elements"
import { Input } from "@components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { ScrollArea } from "@components/ui/scroll-area"
import { SelectItem } from "@components/ui/select"
import { useDoctypeMetaDocs } from "@hooks/useDoctypeMetaDocs"
import type { RavenAIFunctionParams } from "@raven/types/RavenAI/RavenAIFunctionParams"
import { getActiveDoctypeName, getFieldInfoFromDocField, getTableFields, getValidVariableFields, resolveLinkDoctypeName } from "./variableFieldMapping"

/** Add/Edit form for a single function variable; owns its form so the doctype/field selects can autofill the rest. */
const DoctypeVariableDialogForm = ({ doctype, onAdd, defaultValues }: {
    doctype: string
    onAdd: (data: Partial<RavenAIFunctionParams>) => void
    defaultValues?: Partial<RavenAIFunctionParams>
}) => {
    const methods = useForm<RavenAIFunctionParams>({
        defaultValues: {
            ...defaultValues,
            child_table_name: defaultValues?.child_table_name ? defaultValues.child_table_name : doctype,
        },
    })

    const onSubmit = (data: RavenAIFunctionParams) => {
        onAdd(data.child_table_name === doctype ? { ...data, child_table_name: "" } : data)
    }

    return (
        <Form {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
                <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-0.5">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <TableSelectionField doctype={doctype} />
                            <FieldSelectionField doctype={doctype} />
                        </div>
                        <OtherFormFields />
                        <OptionsField doctype={doctype} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" size="md">{_("Close")}</Button></DialogClose>
                        <Button type="button" size="md" onClick={methods.handleSubmit(onSubmit)}>{_("Add")}</Button>
                    </DialogFooter>
                </div>
            </form>
        </Form>
    )
}

export default DoctypeVariableDialogForm

/** DocType select — the main doctype or one of its Table/Table MultiSelect fields. */
const TableSelectionField = ({ doctype }: { doctype: string }) => {
    const { setValue } = useFormContext<RavenAIFunctionParams>()
    const { doc: doctypeMeta } = useDoctypeMetaDocs(doctype)
    const tableFields = getTableFields(doctypeMeta)

    // Switching the doctype resets the previously autofilled field values.
    const onDocTypeChange = () => {
        setValue("fieldname", "")
        setValue("description", "")
        setValue("options", "")
        setValue("type", "string")
        setValue("required", 0)
    }

    return (
        <SelectFormField
            name="child_table_name"
            label={_("DocType")}
            isRequired
            disabled={tableFields?.length === 0}
            rules={{ onChange: onDocTypeChange }}
        >
            <SelectItem value={doctype}>{doctype}</SelectItem>
            {tableFields?.map((field) => (
                <SelectItem key={field.fieldname} value={field.fieldname ?? ""}>{field.options ?? ""} ({field.fieldname})</SelectItem>
            ))}
        </SelectFormField>
    )
}

/** Field select — fields of the active doctype, autofilling the rest of the form. */
const FieldSelectionField = ({ doctype }: { doctype: string }) => {
    const { setValue } = useFormContext<RavenAIFunctionParams>()
    const tableField = useWatch<RavenAIFunctionParams, "child_table_name">({ name: "child_table_name" })
    const { doc: doctypeMeta } = useDoctypeMetaDocs(doctype)
    const doctypeName = getActiveDoctypeName(doctypeMeta, tableField, doctype)
    const { doc: fieldDoctypeMeta } = useDoctypeMetaDocs(doctypeName)
    const fields = getValidVariableFields(fieldDoctypeMeta)

    const onFieldSelect = (fieldname: string) => {
        const field = fields?.find((f) => f.fieldname === fieldname)
        if (!field) return
        const info = getFieldInfoFromDocField(field)
        setValue("description", info.description)
        setValue("options", info.options)
        setValue("type", info.type)
        setValue("required", field.reqd ?? 0)
    }

    return (
        <SelectFormField
            name="fieldname"
            label={_("Field")}
            isRequired
            rules={{
                required: _("Field is required"),
                onChange: (event) => onFieldSelect(event.target.value),
            }}
        >
            {fields?.map((field) => (
                <SelectItem key={field.fieldname} value={field.fieldname ?? ""}>
                    <span>{field.label} ({field.fieldname})</span>
                    <Badge variant="subtle" theme="gray">{field.fieldtype}</Badge>
                </SelectItem>
            ))}
        </SelectFormField>
    )
}

const OtherFormFields = () => {


    const do_not_ask_ai = useWatch<RavenAIFunctionParams, "do_not_ask_ai">({ name: "do_not_ask_ai" })

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-4">
                    <SelectFormField
                        name="type"
                        label={_("Variable Type")}
                        isRequired
                        rules={{ required: _("Type is required") }}
                    >
                        <SelectItem value="string">{_("String")}</SelectItem>
                        <SelectItem value="integer">{_("Integer")}</SelectItem>
                        <SelectItem value="number">{_("Number")}</SelectItem>
                        <SelectItem value="boolean">{_("Boolean")}</SelectItem>
                    </SelectFormField>
                    <SwitchFormField name="required" label={_("Required")} />
                    <SwitchFormField name="do_not_ask_ai" label={_("Do not ask AI to fill this field?")} />
                </div>
                <DataField
                    name="default_value"
                    label={_("Default Value")}
                    isRequired={do_not_ask_ai ? true : false}
                    rules={{
                        required: do_not_ask_ai ? _("Default value is required if AI is not asked to fill this field") : false,
                    }}
                    formDescription={_("You can specify a default value for this variable. If the AI does not fill this field, then the default value will be used.")}
                />
            </div>
            <SmallTextField
                name="description"
                label={_("Description")}
                isRequired
                rules={{ required: true }}
                inputProps={{ placeholder: _("Enter a description for this variable") }}
                formDescription={_("This is used to describe what this variable is used for. A better description will help the AI Bot perform better.")}
            />
        </div>
    )
}

const OptionsField = ({ doctype }: { doctype: string }) => {

    const fieldname = useWatch<RavenAIFunctionParams, "fieldname">({ name: "fieldname" })
    const child_table_name = useWatch<RavenAIFunctionParams, "child_table_name">({ name: "child_table_name" })
    const { doc: doctypeMeta } = useDoctypeMetaDocs(doctype)
    // The active doctype — resolve the child doctype when a table field is selected.
    const doctypeName = getActiveDoctypeName(doctypeMeta, child_table_name, doctype)

    return (
        <div className="flex flex-col gap-1.5">
            <SmallTextField
                name="options"
                label={_("Options")}
                inputProps={{ rows: 5, placeholder: _("Add options separated by a new line.") }}
            />
            <p className="text-p-sm text-ink-gray-6">
                {_("You can limit the values that the bot can fill in this field by adding options.")}
                <br />
                {_("This helps the bot to make less mistakes.")}
            </p>
            <div className="pt-2">
                {fieldname ? <OptionsAutoFill doctype={doctypeName} fieldname={fieldname} /> : null}
            </div>
        </div>
    )
}

/** Link-field options assist — autofill or pick options from the linked doctype. */
const OptionsAutoFill = ({ doctype, fieldname }: { doctype: string, fieldname: string }) => {
    const { doc: doctypeMeta } = useDoctypeMetaDocs(doctype)
    const linkDoctypeName = resolveLinkDoctypeName(doctypeMeta, fieldname)
    const { setValue } = useFormContext<RavenAIFunctionParams>()
    const { db } = useContext(FrappeContext) as FrappeConfig
    const { data } = useFrappeGetCall<{ message: number }>(
        "frappe.desk.reportview.get_count",
        { doctype: linkDoctypeName, limit: 21 },
        linkDoctypeName ? undefined : null
    )

    const autoFillOptions = () => {
        db.getDocList(linkDoctypeName, { fields: ["name"] }).then((options) => {
            setValue("options", options.map((option) => option.name).join("\n"))
        })
    }

    if (!linkDoctypeName || !data || data?.message === 0) {
        return null
    }

    // More than 20 options — let the user search and pick from the list
    if (data?.message === 21) {
        return (
            <Alert theme="blue">
                <AlertTitle>{_("Quickly import {0}s?", [linkDoctypeName])}</AlertTitle>
                <AlertDescription>
                    <QuickImportPopover doctype={linkDoctypeName} />
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <Alert theme="blue">
            <AlertTitle>
                {_("There are only {0} options in {1}.", [String(data.message), linkDoctypeName])}
                <br />
                {_("Do you want to autofill these as options?")}
            </AlertTitle>
            <AlertDescription>
                <Button type="button" variant="outline" onClick={autoFillOptions}>
                    {_("Auto Fill Options")}
                </Button>
            </AlertDescription>
        </Alert>
    )
}

const QuickImportPopover = ({ doctype }: { doctype: string }) => {
    const [searchText, setSearchText] = useState("")
    const { data } = useSearch(doctype, searchText, undefined, 15)
    const { setValue, getValues } = useFormContext<RavenAIFunctionParams>()

    const addToList = (value: string) => {
        const optionsArray = getValues("options") ? (getValues("options") ?? "").split("\n") : []
        if (optionsArray.includes(value)) return
        setValue("options", [...optionsArray, value].join("\n"))
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline">
                    {_("Select {0}s", [doctype])}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px]">
                <div className="flex flex-col gap-2">
                    <div className="relative">
                        <SearchIcon className="text-ink-gray-5 absolute top-1/2 ltr:left-2.5 rtl:right-2.5 size-4 -translate-y-1/2" />
                        <Input
                            className="pl-8"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder={_("Search")}
                        />
                    </div>
                    <ScrollArea viewportClassName="max-h-[360px]">
                        <div className="flex flex-col">
                            {data?.message?.slice(0, 15).map((item) => (
                                <div
                                    key={item.value}
                                    role="button"
                                    className="cursor-pointer rounded-md px-2 py-2.5 hover:bg-surface-gray-2 md:py-1.5"
                                    onClick={() => addToList(item.value)}
                                >
                                    <p className="text-base font-medium md:text-sm">{item.value}</p>
                                    {item.description ? <p className="text-xs font-light">{item.description}</p> : null}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </PopoverContent>
        </Popover>
    )
}
