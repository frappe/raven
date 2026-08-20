import { useFrappeGetDoc, useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { DropdownMenuItem } from "@components/ui/dropdown-menu"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import {
    SettingsPanelContent, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import _ from "@lib/translate"
import { useSaveHotkey } from "@hooks/useSaveHotkey"
import { RecordActionsMenu } from "../RecordActionsMenu"
import { WEBHOOKS_LIST_KEY } from "./WebhookListView"
import { WebhookForm } from "./WebhookForm"

type Props = { webhookID: string; onBack: () => void }

/** In-panel view/edit of an existing webhook. */
const WebhookDetailView = ({ webhookID, onBack }: Props) => {
    const { data, error, isLoading, mutate } = useFrappeGetDoc<RavenWebhook>(
        "Raven Webhook", webhookID, undefined, { shouldRetryOnError: false },
    )

    return (
        <>
            {error && <SettingsPanelContent><ErrorBanner error={error} /></SettingsPanelContent>}
            {isLoading && (
                <SettingsPanelContent className="items-center justify-center"><Spinner /></SettingsPanelContent>
            )}
            {data && <WebhookDetailContent key={data.name} data={data} mutate={() => { void mutate() }} onBack={onBack} />}
        </>
    )
}

const WebhookDetailContent = ({
    data, mutate, onBack,
}: { data: RavenWebhook; mutate: () => void; onBack: () => void }) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<RavenWebhook>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenWebhook>({ defaultValues: data })
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0

    const onSubmit = (formData: RavenWebhook) => {
        updateDoc("Raven Webhook", formData.name, formData).then((doc) => {
            toast.success(_("Webhook updated"))
            mutate()
            globalMutate(WEBHOOKS_LIST_KEY)
            if (doc) methods.reset(doc)
        })
    }

    useSaveHotkey(() => methods.handleSubmit(onSubmit)())

    const toggleEnabled = () => {
        updateDoc("Raven Webhook", data.name, { enabled: data.enabled ? 0 : 1 }).then(() => {
            toast.success(data.enabled ? _("Webhook disabled") : _("Webhook enabled"))
            mutate()
            globalMutate(WEBHOOKS_LIST_KEY)
        })
    }

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype="Raven Webhook"
                                docName={data.name}
                                deleteDescription={_("Are you sure you want to delete this webhook?")}
                                deleteSuccessMessage={_("Webhook deleted")}
                                onDeleted={() => { globalMutate(WEBHOOKS_LIST_KEY); onBack() }}
                            >
                                <DropdownMenuItem onClick={toggleEnabled}>
                                    {data.enabled ? _("Disable") : _("Enable")}
                                </DropdownMenuItem>
                            </RecordActionsMenu>
                            <Button type="submit" size="sm" disabled={loading}>
                                {loading && <Spinner />}
                                {loading ? _("Saving") : _("Save")}
                            </Button>
                        </div>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <Button
                            type="button" variant="ghost" size="sm" isIconButton
                            onClick={onBack} aria-label={_("Back to webhooks")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        <span className="truncate">{data.name}</span>
                        {isDirty
                            ? <Badge variant="outline">{_("Not Saved")}</Badge>
                            : <Badge variant={data.enabled ? "subtle" : "outline"}>{data.enabled ? _("Enabled") : _("Disabled")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <WebhookForm isEdit />
                </SettingsPanelContent>
            </form>
        </FormProvider>
    )
}

export default WebhookDetailView
