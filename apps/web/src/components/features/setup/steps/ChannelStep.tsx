import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useFrappePostCall, useFrappeUpdateDoc } from "frappe-react-sdk"
import { ChannelNameInput, channelNameRules } from "@components/features/channel/CreateChannel/ChannelNameInput"
import { ChannelTypeSelector } from "@components/features/channel/CreateChannel/ChannelTypeSelector"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@components/ui/form"
import { useIsMobile } from "@hooks/use-mobile"
import { useWorkspaces } from "@hooks/useWorkspaces"
import _ from "@lib/translate"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import type { RavenChannel } from "@raven/types/RavenChannelManagement/RavenChannel"
import { channelStore } from "@stores/channels/store"
import { useChannels } from "@stores/channels/useChannelList"
import { findExistingChannel } from "./existingChannel"
import { StepFooter } from "./StepFooter"
import { useReportBusy } from "./useReportBusy"
import type { SetupStepBodyProps } from "../types"

type ChannelForm = { channel_name: string; type: RavenChannel["type"] }

/** Left empty, the channel is called "general", so there's always one to land in. */
const SUGGESTED_NAME = "general"

/** Open by default, so everyone who joins the workspace is in it. Back here, it edits the same channel. */
export const ChannelStep = (props: SetupStepBodyProps) => {
    const { isLoading } = useChannels()
    // Made already but the list isn't in yet: wait, or the form would start from Open and could save it over a private channel.
    if (props.setup.channel && isLoading) return null
    const saved = props.setup.channel ? channelStore.getChannel(props.setup.channel.id) : undefined
    return <ChannelForm {...props} saved={saved} />
}

const ChannelForm = ({ setup, isLast, finishing, onDone, onPreview, onBusyChange, saved }: SetupStepBodyProps & { saved?: ChannelListItem }) => {
    const { workspaces } = useWorkspaces()
    const form = useForm<ChannelForm>({
        defaultValues: {
            channel_name: setup.channel?.name ?? "",
            type: saved?.type ?? "Open",
        },
    })
    const type = useWatch({ control: form.control, name: "type" })
    const typedChannel = useWatch({ control: form.control, name: "channel_name" })
    const { channels } = useChannels()
    // Left empty in a workspace that already has "general" (a site set up before), setup takes that one.
    const existingGeneral = !setup.channel && !typedChannel ? findExistingChannel(channels, setup.workspace, SUGGESTED_NAME) : undefined
    useEffect(() => {
        onPreview({ channel: { name: typedChannel || SUGGESTED_NAME, type: existingGeneral?.type ?? type } })
    }, [typedChannel, type, existingGeneral]) // eslint-disable-line react-hooks/exhaustive-deps
    const { call: createChannel, loading: creating, error: createError } = useFrappePostCall<{ message: ChannelListItem }>("raven.api.raven_channel.create_channel")
    const { updateDoc, loading: updating, error: updateError } = useFrappeUpdateDoc()
    const loading = creating || updating
    useReportBusy(loading, onBusyChange)
    const isMobile = useIsMobile()

    const workspaceName = workspaces.find((workspace) => workspace.name === setup.workspace)?.workspace_name
    // Nothing to save goes on; otherwise the button says whether it creates or saves.
    const label = existingGeneral || (setup.channel && !form.formState.isDirty)
        ? isLast ? _("Finish") : _("Continue")
        : !setup.channel
            ? isLast ? _("Create and finish") : _("Create channel")
            : isLast ? _("Save and finish") : _("Save and continue")

    const onSubmit = ({ channel_name, type }: ChannelForm) => {
        // A second Enter before the first save lands would make a second one.
        if (loading || finishing) return
        const name = channel_name || SUGGESTED_NAME
        if (existingGeneral) return onDone({ channel: { id: existingGeneral.name, name: existingGeneral.channel_name } })
        if (setup.channel) {
            const id = setup.channel.id
            if (!form.formState.isDirty) return onDone()
            updateDoc("Raven Channel", id, { channel_name: name, type })
                .then(() => {
                    channelStore.patchChannel(id, { channel_name: name, type })
                    onDone({ channel: { id, name } })
                })
                .catch(() => { })
            return
        }
        createChannel({ channel_name: name, channel_description: "", type, workspace: setup.workspace })
            .then(({ message: channel }) => {
                // The creator is its admin; the sidebar shows it before the list refetches.
                channelStore.upsertChannel({ ...channel, is_admin: 1, allow_notifications: 1 })
                onDone({ channel: { id: channel.name, name } })
            })
            .catch(() => { })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <p className="text-p-base text-ink-gray-7">
                    {_("Where your team talks in {0}. Add more anytime from the sidebar.", [workspaceName ?? _("your workspace")])}
                </p>
                {createError && <ErrorBanner error={createError} />}
                {updateError && <ErrorBanner error={updateError} />}
                <FormField
                    control={form.control}
                    name="channel_name"
                    rules={{
                        // The app's channel name rules; left empty, the name is "general", which passes them.
                        validate: (value) => {
                            if (!value) return true
                            const { minLength, maxLength, pattern } = channelNameRules()
                            if (value.length < minLength.value) return minLength.message
                            if (value.length > maxLength.value) return maxLength.message
                            return pattern.value.test(value) || pattern.message
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{_("Name")}</FormLabel>
                            <FormControl>
                                <ChannelNameInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    channelType={type}
                                    placeholder={SUGGESTED_NAME}
                                    autoFocus={!isMobile && !setup.channel}
                                    // Tab in the empty field takes the suggestion, like a ghost completion.
                                    onKeyDown={(event) => {
                                        if (event.key !== "Tab" || event.shiftKey || field.value) return
                                        event.preventDefault()
                                        field.onChange(SUGGESTED_NAME)
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        // An existing "general" is used as it is: show its type, and don't offer one that won't apply.
                        <fieldset disabled={!!existingGeneral} className="contents">
                            <ChannelTypeSelector value={existingGeneral?.type ?? field.value} onChange={field.onChange} />
                        </fieldset>
                    )}
                />
                {existingGeneral && workspaceName && (
                    <p className="text-p-sm text-ink-gray-5">{_("{0} already has #general, so setup uses it.", [workspaceName])}</p>
                )}
                <StepFooter>
                    <Button type="submit" variant="solid" size="md" loading={loading || finishing}>
                        {label}
                    </Button>
                </StepFooter>
            </form>
        </Form>
    )
}
