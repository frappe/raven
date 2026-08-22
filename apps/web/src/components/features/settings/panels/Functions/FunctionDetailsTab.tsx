import { useFormContext, useWatch } from "react-hook-form"
import {
    DataField, LinkFormField, SelectFormField, SmallTextField, SwitchFormField,
} from "@components/ui/form-elements"
import { SelectGroup, SelectItem, SelectLabel } from "@components/ui/select"
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import { FUNCTION_TYPES } from "./FunctionConstants"
import _ from "@lib/translate"

/** DocTypes a function of these types operates on — reference doctype is required for them. */
const DOCUMENT_REF_FUNCTIONS = ["Get Document", "Get Multiple Documents", "Get List", "Get Value", "Set Value", "Create Document", "Create Multiple Documents", "Update Document", "Update Multiple Documents", "Delete Document", "Delete Multiple Documents", "Submit Document", "Cancel Document", "Get Amended Document"]

/** Function name + description templates per reference-doctype function type. */
const REF_DOCTYPE_TEMPLATES: Record<string, { description: (dt: string) => string; functionName: (slug: string) => string }> = {
    "Get Document": {
        description: (dt) => `This function fetches a ${dt} document using its name from the system.`,
        functionName: (slug) => `get_${slug}`,
    },
    "Get Multiple Documents": {
        description: (dt) => `This function fetches multiple ${dt} documents using their names from the system.`,
        functionName: (slug) => `get_${slug}s`,
    },
    "Get List": {
        description: (dt) => `This function fetches a list of ${dt} from the system.`,
        functionName: (slug) => `get_${slug}_list`,
    },
    "Get Value": {
        description: (dt) => `This function fetches a value from a ${dt} in the system.`,
        functionName: (slug) => `get_${slug}_value`,
    },
    "Set Value": {
        description: (dt) => `This function sets a value in a ${dt} in the system.`,
        functionName: (slug) => `set_${slug}_value`,
    },
    "Create Document": {
        description: (dt) => `This function creates a ${dt} in the system.`,
        functionName: (slug) => `create_${slug}`,
    },
    "Create Multiple Documents": {
        description: (dt) => `This function creates multiple ${dt} in the system.`,
        functionName: (slug) => `create_${slug}s`,
    },
    "Update Document": {
        description: (dt) => `This function updates a ${dt} in the system.`,
        functionName: (slug) => `update_${slug}`,
    },
    "Update Multiple Documents": {
        description: (dt) => `This function updates multiple ${dt} in the system.`,
        functionName: (slug) => `update_${slug}s`,
    },
    "Delete Document": {
        description: (dt) => `This function deletes a ${dt} from the system.`,
        functionName: (slug) => `delete_${slug}`,
    },
    "Delete Multiple Documents": {
        description: (dt) => `This function deletes multiple ${dt} from the system.`,
        functionName: (slug) => `delete_${slug}s`,
    },
    "Submit Document": {
        description: (dt) => `This function submits a ${dt} in the system.`,
        functionName: (slug) => `submit_${slug}`,
    },
    "Cancel Document": {
        description: (dt) => `This function cancels a ${dt} in the system.`,
        functionName: (slug) => `cancel_${slug}`,
    },
    "Get Amended Document": {
        description: (dt) => `This function gets the amended document for a ${dt} in the system.`,
        functionName: (slug) => `get_amended_${slug}`,
    },
}

/** Details form fields for a Raven AI Function — rendered inside the editor's FormProvider. */
const FunctionDetailsTab = ({ isEdit }: { isEdit?: boolean }) => (
    <div className="flex flex-col gap-4">
        <FunctionTypeField />
        <ReferenceDoctypeField />
        <DataField
            name="function_name"
            label={_("Name")}
            isRequired
            readOnly={isEdit}
            rules={{
                required: _("Name is required"),
                validate: (value: string) => (!value.includes(" ") ? true : _("Name cannot contain spaces")),
            }}
            inputProps={{ placeholder: "get_purchase_invoice" }}
            formDescription={_("This needs to be unique and cannot contain spaces.")}
        />
        <SmallTextField
            name="description"
            label={_("Description")}
            isRequired
            rules={{ required: _("Description is required") }}
            inputProps={{ placeholder: _("Describe what this function does.") }}
            formDescription={_("This is used to describe what this function does to the AI Agent.")}
        />
        <CustomFunction />
        <RequiresWritePermissions />
    </div>
)

/** Type select grouped by Standard / Miscellaneous / Bulk Operations, with helper text below. */
const FunctionTypeField = () => {
    const { setValue } = useFormContext<RavenAIFunction>()

    const onFunctionChange = (event: { target: { value: string } }) => {
        const functionDef = FUNCTION_TYPES.find((f) => f.value === event.target.value)

        if (event.target.value === "Attach File to Document") {
            setValue("reference_doctype", "")
            setValue("function_name", "attach_file_to_document")
            setValue("description", "This function attaches a file to a document in the system. Call this function after you have created or updated the document.")
        }

        if (functionDef) {
            if (functionDef.requires_write_permissions !== undefined) {
                setValue("requires_write_permissions", functionDef.requires_write_permissions ? 1 : 0)
            }

            if (functionDef.value !== "Custom Function") {
                setValue("function_path", "")
            }
        }
    }

    return (
        <>
            <SelectFormField
                name="type"
                label={_("Type")}
                isRequired
                rules={{ required: _("Type is required"), onChange: onFunctionChange }}
            >
                <SelectGroup>
                    <SelectLabel>{_("Standard")}</SelectLabel>
                    {FUNCTION_TYPES.filter((f) => f.type === "Standard").map((f) => (
                        <SelectItem value={f.value} key={f.value}>{f.value}</SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                    <SelectLabel>{_("Miscellaneous")}</SelectLabel>
                    {FUNCTION_TYPES.filter((f) => f.type === "Other").map((f) => (
                        <SelectItem value={f.value} key={f.value}>{f.value}</SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                    <SelectLabel>{_("Bulk Operations")}</SelectLabel>
                    {FUNCTION_TYPES.filter((f) => f.type === "Bulk Operations").map((f) => (
                        <SelectItem value={f.value} key={f.value}>{f.value}</SelectItem>
                    ))}
                </SelectGroup>
            </SelectFormField>
            <FunctionHelperText />
        </>
    )
}

/** Shows the description of the currently selected function type. */
const FunctionHelperText = () => {
    const type = useWatch<RavenAIFunction>({ name: "type" })
    const functionDef = FUNCTION_TYPES.find((f) => f.value === type)

    return (
        <p className="text-ink-gray-6 text-p-sm">
            {functionDef ? functionDef.description : _("Select a function type from the dropdown above.")}
        </p>
    )
}

/** Reference DocType link field, only for types that operate on a document. */
const ReferenceDoctypeField = () => {
    const { setValue, getValues } = useFormContext<RavenAIFunction>()

    const type = useWatch<RavenAIFunction>({ name: "type" })

    const onReferenceDoctypeChange = (event: { target: { value: string } }) => {
        if (event.target.value) {
            const template = REF_DOCTYPE_TEMPLATES[type]
            if (template) {
                const slug = event.target.value.toLowerCase().replace(/\s/g, "_")
                const function_name = template.functionName(slug)
                const description = template.description(event.target.value)
                if (function_name && !getValues("function_name")) {
                    setValue("function_name", function_name)
                }
                if (description) {
                    setValue("description", description)
                }
            }
        }
    }

    if (!DOCUMENT_REF_FUNCTIONS.includes(type)) {
        return null
    }

    return (
        <LinkFormField
            name="reference_doctype"
            label={_("Reference Doctype")}
            isRequired
            doctype="DocType"
            filters={[["istable", "=", 0], ["issingle", "=", 0]]}
            rules={{ required: _("Reference Doctype is required"), onChange: onReferenceDoctypeChange }}
            formDescription={_("The document you want this function to operate on.")}
        />
    )
}

/** Custom-function-only fields: dotted path + pass-params-as-JSON switch. */
const CustomFunction = () => {
    const type = useWatch<RavenAIFunction>({ name: "type" })

    if (type !== "Custom Function") {
        return null
    }

    return (
        <>
            <SmallTextField
                name="function_path"
                label={_("Custom Function Path")}
                isRequired
                rules={{
                    required: _("Path is required"),
                    validate: (value?: string) => (!value?.includes(" ") ? true : _("Path cannot contain spaces")),
                }}
                inputProps={{ placeholder: "myapp.api.my_custom_function" }}
                formDescription={_("Dotted path to the custom function/API. Cannot contain spaces.")}
            />
            <SwitchFormField
                name="pass_parameters_as_json"
                label={_("Pass parameters as JSON")}
                formDescription={_("If checked, the params will be passed as a JSON object instead of named parameters")}
            />
        </>
    )
}

/** Write-permissions switch, only editable for custom functions. */
const RequiresWritePermissions = () => {
    const type = useWatch<RavenAIFunction>({ name: "type" })

    return (
        <SwitchFormField
            name="requires_write_permissions"
            label={_("Requires Write Permissions")}
            formDescription={_("Check this if the function you have selected requires write permissions.")}
            disabled={type !== "Custom Function"}
        />
    )
}

export default FunctionDetailsTab
