import { useMemo } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@components/ui/select"
import { SelectFormField, SmallTextField } from "@components/ui/form-elements"
import { ChannelSelect } from "@components/common/ChannelSelect/ChannelSelect"
import { useChannels } from "@stores/channels/useChannelList"
import { usersStore } from "@stores/usersStore"
import { UserAvatar } from "@components/features/message/UserAvatar"
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import _ from "@lib/translate"
import { TriggerEvents } from "./utils"
import { FieldHelp } from "./webhookFormBits"

/** Conditions tab — optionally gate the webhook on channel / user / channel-type / custom expression. */
export const WebhookConditionForm = () => {
    const { control, setValue } = useFormContext<RavenWebhook>()
    const { channels } = useChannels()
    const usersMap = usersStore.getSnapshot()
    const users = useMemo(() => Array.from(usersMap.values()).filter((u) => u.type === "User"), [usersMap])

    const needCondition = useWatch({ control, name: "trigger_webhook_on_condition" })
    const conditionOn = useWatch({ control, name: "conditions_on" })
    const webhookTrigger = useWatch({ control, name: "webhook_trigger" })

    const triggerOn = useMemo(
        () => (webhookTrigger ? TriggerEvents.find((e) => e.label === webhookTrigger)?.trigger_on ?? [] : []),
        [webhookTrigger],
    )

    const clearConditionFields = () => {
        setValue("condition", "")
        setValue("channel_id", "")
        setValue("user", "")
        setValue("channel_type", "")
    }

    return (
        <div className="flex flex-col gap-5 w-full">
            <div className="flex items-center gap-2">
                <Controller
                    control={control}
                    name="trigger_webhook_on_condition"
                    render={({ field }) => (
                        <Switch
                            checked={!!field.value}
                            onCheckedChange={(v) => {
                                field.onChange(v ? 1 : 0)
                                if (!v) { setValue("conditions_on", ""); clearConditionFields() }
                            }}
                        />
                    )}
                />
                <span className="text-p-base text-ink-gray-8">{_("Trigger this webhook based on a condition")}</span>
            </div>

            {needCondition ? (
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label>{_("Trigger On")}</Label>
                        <Controller
                            control={control}
                            name="conditions_on"
                            rules={{ required: _("Field is required") }}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={(v) => { field.onChange(v); clearConditionFields() }}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder={_("Select Field")} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>{_("Trigger On")}</SelectLabel>
                                            {triggerOn.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            <SelectItem value="Custom">{_("Custom")}</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <FieldHelp>{_("Field on which the condition will be applied")}</FieldHelp>
                    </div>
                </div>
            ) : null}

            {needCondition && conditionOn === "Custom" ? (
                <div className="grid grid-cols-2 gap-4">
                    <SmallTextField
                        name="condition"
                        label={_("Condition")}
                        isRequired
                        inputProps={{ className: "min-h-[100px]" }}
                        rules={{ required: conditionOn === "Custom" ? _("Condition is required") : false }}
                        formDescription={_("The webhook will be triggered if this expression is true.")}
                    />
                    <div>
                        <pre className="mt-6 rounded-md bg-surface-gray-2 p-3 text-p-sm text-ink-gray-7">
                            <span className="font-medium">{_("Try something like:")}</span>{"\n"}
                            doc.channel_id == 'general'{"\n"}
                            doc.is_direct_message == 1{"\n"}
                            doc.owner == 'Administrator'
                        </pre>
                    </div>
                </div>
            ) : needCondition && conditionOn === "Channel" ? (
                <div className="grid grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label>{_("Channel")}</Label>
                        <Controller
                            control={control}
                            name="channel_id"
                            render={({ field }) => (
                                <ChannelSelect
                                    channels={channels}
                                    value={field.value ?? ""}
                                    onValueChange={field.onChange}
                                    searchable
                                    className="w-full"
                                    triggerClassName="w-full"
                                />
                            )}
                        />
                        <FieldHelp>{_("Webhook will trigger only if the message is sent on this channel.")}</FieldHelp>
                    </div>
                </div>
            ) : needCondition && conditionOn === "User" ? (
                <div className="grid grid-cols-2">
                    <SelectFormField
                        name="user"
                        label={_("User")}
                        formDescription={_("Webhook will trigger only if the message is sent by this user.")}
                    >
                        <SelectGroup>
                            <SelectLabel>{_("User")}</SelectLabel>
                            {users.map((user) => (
                                <SelectItem key={user.name} value={user.name}>
                                    <span className="flex items-center gap-2 min-w-0">
                                        <UserAvatar user={user} size="sm" showStatusIndicator={false} />
                                        <span className="truncate">{user.full_name ?? user.name}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectFormField>
                </div>
            ) : needCondition && conditionOn === "Channel Type" ? (
                <div className="grid grid-cols-2">
                    <SelectFormField
                        name="channel_type"
                        label={_("Channel Type")}
                        formDescription={_("The webhook will trigger if the channel type equals the value selected here.")}
                    >
                        <SelectGroup>
                            <SelectLabel>{_("Channel Type")}</SelectLabel>
                            <SelectItem value="Public">{_("Public")}</SelectItem>
                            <SelectItem value="Private">{_("Private")}</SelectItem>
                            <SelectItem value="Open">{_("Open")}</SelectItem>
                            <SelectItem value="DM">{_("Direct Message")}</SelectItem>
                            <SelectItem value="Self Message">{_("Self Message")}</SelectItem>
                        </SelectGroup>
                    </SelectFormField>
                </div>
            ) : null}
        </div>
    )
}

export default WebhookConditionForm
