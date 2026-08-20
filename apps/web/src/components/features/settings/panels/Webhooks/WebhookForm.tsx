import { Controller, useFormContext, useWatch } from "react-hook-form"
import { AppWindowIcon, CodeIcon, DatabaseIcon, WorkflowIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import { Badge } from "@components/ui/badge"
import { DataField } from "@components/ui/form-elements"
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@components/ui/select"
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import _ from "@lib/translate"
import { TriggerEvents } from "./utils"
import { WebhookData } from "./WebhookDataTable"
import { WebhookHeaders } from "./WebhookHeaders"
import { WebhookConditionForm } from "./WebhookConditionForm"
import { FieldError, FieldHelp } from "./webhookFormBits"

/** Create/edit form for a Raven Webhook — General / Conditions / Data / Headers tabs. */
export const WebhookForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
        <TabsList>
            <TabsTrigger value="general"><AppWindowIcon /> {_("General")}</TabsTrigger>
            <TabsTrigger value="condition"><WorkflowIcon /> {_("Conditions")}</TabsTrigger>
            <TabsTrigger value="data"><DatabaseIcon /> {_("Data")}</TabsTrigger>
            <TabsTrigger value="headers"><CodeIcon /> {_("Headers")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="pt-4">
            <GeneralWebhookForm isEdit={isEdit} />
        </TabsContent>
        <TabsContent value="condition" className="pt-4">
            <WebhookConditionForm />
        </TabsContent>
        <TabsContent value="data" className="pt-4">
            <WebhookData />
        </TabsContent>
        <TabsContent value="headers" className="pt-4">
            <WebhookHeaders />
        </TabsContent>
    </Tabs>
)

const GeneralWebhookForm = ({ isEdit }: { isEdit: boolean }) => {
    const { formState: { errors }, control, setValue } = useFormContext<RavenWebhook>()
    const security = useWatch({ control, name: "enable_security" })

    return (
        <div className="flex flex-col gap-5 w-full">
            {!isEdit && (
                <DataField
                    name="name"
                    label={_("Name")}
                    isRequired
                    inputProps={{ autoFocus: true }}
                    rules={{
                        required: _("Name is required"),
                        maxLength: { value: 140, message: _("Name should not exceed 140 characters") },
                    }}
                />
            )}

            <DataField
                name="request_url"
                label={_("Request URL")}
                isRequired
                rules={{
                    required: _("Request URL is required"),
                    maxLength: { value: 140, message: _("Request URL should not exceed 140 characters") },
                }}
            />

            <div className="grid grid-cols-2 gap-4">
                <DataField
                    name="timeout"
                    label={_("Request Timeout")}
                    inputProps={{ type: "number" }}
                    formDescription={_("The number of seconds until the request expires.")}
                />

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="webhook_trigger">{_("Trigger Event")} <span className="text-ink-red-3">*</span></Label>
                    <Controller
                        control={control}
                        name="webhook_trigger"
                        rules={{ required: _("Trigger Event is required") }}
                        render={({ field }) => (
                            <Select
                                value={field.value}
                                onValueChange={(v) => { field.onChange(v); setValue("webhook_data", []) }}
                                disabled={isEdit}
                            >
                                <SelectTrigger id="webhook_trigger" className="w-full">
                                    <SelectValue placeholder={_("Trigger Events")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>{_("Trigger Events")}</SelectLabel>
                                        {TriggerEvents.map((event) => (
                                            <SelectItem key={event.key} value={event.label}>{event.label}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <FieldError message={errors?.webhook_trigger?.message} />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Controller
                        control={control}
                        name="enable_security"
                        render={({ field }) => (
                            <Switch checked={!!field.value} onCheckedChange={(v) => field.onChange(v ? 1 : 0)} />
                        )}
                    />
                    <span className="text-p-base text-ink-gray-8">{_("Enable Security?")}</span>
                    <Badge variant="subtle">{_("Recommended")}</Badge>
                </div>
                <FieldHelp>
                    {_("Add a Webhook Secret so Raven can sign requests. An X-Frappe-Webhook-Signature header (a base64 HMAC-SHA256 of the payload) is added before the request is sent. Do not share the secret publicly.")}
                </FieldHelp>
            </div>

            {security ? (
                <DataField
                    name="webhook_secret"
                    label={_("Webhook Secret")}
                    isRequired
                    inputProps={{ type: "password" }}
                    rules={{
                        required: security ? _("Webhook secret is required") : false,
                        maxLength: { value: 140, message: _("Webhook secret should not exceed 140 characters") },
                    }}
                />
            ) : null}
        </div>
    )
}
export default WebhookForm
