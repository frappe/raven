import { Controller, useFormContext, useWatch } from "react-hook-form"
import { ZapIcon, VariableIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@components/ui/select"
import { LinkFormField } from "@components/ui/form-elements"
import _ from "@lib/translate"
import type { MessageActionFormData } from "./types"
import { MessageActionFieldsBuilder } from "./MessageActionFieldsBuilder"

const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-p-sm text-ink-red-3">{message}</p> : null

const FieldHelp = ({ children }: { children: React.ReactNode }) => (
    <p className="text-p-sm text-ink-gray-5">{children}</p>
)

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
                <div className="flex flex-col gap-1.5">
                    <LinkFormField
                        name="document_type"
                        label={_("Document Type")}
                        isRequired
                        doctype="DocType"
                        filters={[["istable", "=", 0], ["issingle", "=", 0]]}
                        rules={{ required: action === "Create Document" ? _("Document Type is required") : false }}
                    />
                    <FieldHelp>{_("The document you want this action to create.")}</FieldHelp>
                </div>
            )}

            {action === "Custom Function" && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="custom_function_path">{_("Custom Function Path")} <span className="text-ink-red-3">*</span></Label>
                    <Textarea
                        id="custom_function_path"
                        placeholder="myapp.api.my_custom_function"
                        {...register("custom_function_path", {
                            required: action === "Custom Function" ? _("Path is required") : false,
                            validate: (v) => (v?.includes(" ") ? _("Path cannot contain spaces") : true),
                        })}
                    />
                    <FieldHelp>{_("Dotted path to the custom function/API. Cannot contain spaces.")}</FieldHelp>
                    <FieldError message={errors.custom_function_path?.message} />
                </div>
            )}

            {action === "Server Script" && (
                <div className="flex flex-col gap-1.5">
                    <LinkFormField
                        name="server_script"
                        label={_("Server Script")}
                        isRequired
                        doctype="Server Script"
                        filters={[["disabled", "=", 0], ["script_type", "=", "API"]]}
                        rules={{ required: action === "Server Script" ? _("Server Script is required") : false }}
                    />
                    <FieldHelp>{_("The Server Script to run. It must be of type \"API\".")}</FieldHelp>
                </div>
            )}

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

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">{_("Title")} <span className="text-ink-red-3">*</span></Label>
                <Input id="title" placeholder={_("Create support ticket")} {...register("title", { required: _("Title is required") })} />
                <FieldHelp>{_("Title of the message action dialog.")}</FieldHelp>
                <FieldError message={errors.title?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">{_("Description")}</Label>
                <Textarea id="description" placeholder={_("Create a support ticket from the message.")} {...register("description")} />
                <FieldHelp>{_("Shown on the message action dialog.")}</FieldHelp>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="success_message">{_("Success Message")}</Label>
                <Textarea id="success_message" placeholder={_("Ticket created successfully.")} {...register("success_message")} />
                <FieldHelp>{_("Shown in the toast after the action runs.")}</FieldHelp>
            </div>
        </div>
    )
}

export default MessageActionForm
