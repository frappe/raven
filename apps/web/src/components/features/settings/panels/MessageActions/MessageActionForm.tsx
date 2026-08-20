import { Controller, useFormContext, useWatch } from "react-hook-form"
import { ZapIcon, VariableIcon, CodeIcon, ExternalLinkIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { Button } from "@components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@components/ui/dialog"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@components/ui/select"
import { DataField, LinkFormField, SmallTextField, SwitchFormField } from "@components/ui/form-elements"
import _ from "@lib/translate"
import type { MessageActionFormData } from "./types"
import { MessageActionFieldsBuilder } from "./MessageActionFieldsBuilder"

const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-p-sm text-ink-red-3">{message}</p> : null

/** Create/edit form for a Raven Message Action — General + Fields tabs. */
export const MessageActionForm = () => (
    <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
        <TabsList>
            <TabsTrigger value="general"><ZapIcon /> {_("General")}</TabsTrigger>
            <TabsTrigger value="fields"><VariableIcon /> {_("Fields")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="pt-4">
            <GeneralTab />
        </TabsContent>
        <TabsContent value="fields" className="pt-4">
            <MessageActionFieldsBuilder />
        </TabsContent>
    </Tabs>
)

const GeneralTab = () => {
    const { register, control, setValue, formState: { errors } } = useFormContext<MessageActionFormData>()
    const action = useWatch({ control, name: "action" })
    const serverScript = useWatch({ control, name: "server_script" })

    return (
        <div className="flex flex-col gap-5 w-full">
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="action_name">{_("Name")} <span className="text-ink-red-3">*</span></Label>
                    <Input
                        id="action_name"
                        placeholder={_("Create support ticket")}
                        {...register("action_name", {
                            required: _("Name is required"),
                            onBlur: (e) => setValue("title", e.target.value.trim()),
                        })}
                    />
                    <FieldError message={errors.action_name?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label>{_("Action Type")} <span className="text-ink-red-3">*</span></Label>
                    <Controller
                        control={control}
                        name="action"
                        rules={{
                            required: _("Action Type is required"),
                            // Clear the fields belonging to the other action types.
                            onChange: (e) => {
                                if (e.target.value !== "Create Document") setValue("document_type", "")
                                if (e.target.value !== "Custom Function") setValue("custom_function_path", "")
                                if (e.target.value !== "Server Script") setValue("server_script", "")
                            },
                        }}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full"><SelectValue placeholder={_("Pick an action type")} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Create Document">{_("Create Document")}</SelectItem>
                                    <SelectItem value="Custom Function">{_("Custom Function (API)")}</SelectItem>
                                    <SelectItem value="Server Script">{_("Server Script")}</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <FieldError message={errors.action?.message} />
                </div>
            </div>
            {action === "Create Document" && (
                <div className="grid grid-cols-2">
                    <LinkFormField
                        name="document_type"
                        label={_("Document Type")}
                        isRequired
                        doctype="DocType"
                        filters={[["istable", "=", 0], ["issingle", "=", 0]]}
                        rules={{ required: action === "Create Document" ? _("Document Type is required") : false }}
                        formDescription={_("The document you want this action to create.")}
                    />
                </div>
            )}

            {action === "Server Script" && (
                <div className="grid grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <LinkFormField
                            name="server_script"
                            label={_("Server Script")}
                            isRequired
                            doctype="Server Script"
                            filters={[["disabled", "=", 0], ["script_type", "=", "API"]]}
                            rules={{ required: action === "Server Script" ? _("Server Script is required") : false }}
                            formDescription={_("The Server Script to run. It must be of type \"API\".")}
                        />
                        <a
                            href={serverScript ? `/app/server-script/${serverScript}` : "/app/server-script/list"}
                            target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-p-sm text-ink-gray-6 underline underline-offset-2 hover:text-ink-gray-8 w-fit"
                        >
                            {serverScript ? _("Configure {0}", [serverScript]) : _("View Server Scripts")}
                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </a>
                        <div><ViewDocsButton /></div>
                    </div>
                </div>
            )}

            {action === "Custom Function" && (
                <div className="flex flex-col gap-1.5">
                    <SmallTextField
                        name="custom_function_path"
                        label={_("Custom Function Path")}
                        isRequired
                        inputProps={{ placeholder: "myapp.api.my_custom_function" }}
                        rules={{
                            required: action === "Custom Function" ? _("Path is required") : false,
                            validate: (v) => (v?.includes(" ") ? _("Path cannot contain spaces") : true),
                        }}
                        formDescription={_("Dotted path to the custom function/API. Cannot contain spaces.")}
                    />
                    <div><ViewDocsButton /></div>
                </div>
            )}

            <SwitchFormField name="enabled" label={_("Enabled")} />

            <DataField
                name="title"
                label={_("Title")}
                isRequired
                inputProps={{ placeholder: _("Create support ticket") }}
                rules={{ required: _("Title is required") }}
                formDescription={_("Title of the message action dialog.")}
            />

            <SmallTextField
                name="description"
                label={_("Description")}
                inputProps={{ placeholder: _("Create a support ticket from the message.") }}
                formDescription={_("Shown on the message action dialog.")}
            />

            <SmallTextField
                name="success_message"
                label={_("Success Message")}
                inputProps={{ placeholder: _("Ticket created successfully.") }}
                formDescription={_("Shown in the toast after the action runs.")}
            />
        </div>
    )
}

/** How the action's values reach the receiving Server Script / API — shown per action type. */
const EXAMPLES: Record<string, string> = {
    "Server Script": `# Server Scripts would get the values in "frappe.form_dict"
{
    "message_id": "123",
    "action_id": "abc",
    "values": {
    # Values from the fields in the message action dialog
        "field1": "value1",
        "field2": "value2"
    }
}

# You can use the values to perform any action like this:
print(frappe.form_dict.values.field1)`,
    "Custom Function": `# The API would be called directly with the values from the message action dialog.

# Example:
@frappe.whitelist()
def create_ticket(field1, field2):
    # Do something with the values
    frappe.get_doc({
        "doctype": "Ticket",
        "field1": field1,
        "field2": field2
    }).insert()`,
}

const ViewDocsButton = () => {
    const { control } = useFormContext<MessageActionFormData>()
    const action = useWatch({ control, name: "action" })
    if (!action || !EXAMPLES[action]) return null

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm"><CodeIcon />{_("View Docs")}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{_("Documentation")}</DialogTitle>
                    <DialogDescription>
                        {_("The following code sample shows how to use the message action values in a {0}.", [action])}
                    </DialogDescription>
                </DialogHeader>
                <pre className="rounded-md bg-surface-gray-2 p-3 text-p-sm text-ink-gray-7 overflow-auto max-h-96 whitespace-pre-wrap">
                    <code>{EXAMPLES[action]}</code>
                </pre>
            </DialogContent>
        </Dialog>
    )
}

export default MessageActionForm
