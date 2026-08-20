import { useFrappeCreateDoc, useSWRConfig } from "frappe-react-sdk"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Spinner } from "@components/ui/spinner"
import ErrorBanner from "@components/ui/error-banner"
import {
    SettingsPanelContent, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import _ from "@lib/translate"
import { useSaveHotkey } from "@hooks/useSaveHotkey"
import { WebhookForm } from "./WebhookForm"
import { WEBHOOKS_LIST_KEY } from "./WebhookListView"

type Props = { onBack: () => void; onCreated: (webhookID: string) => void }

/** In-panel "create a webhook" sub-view. */
const WebhookCreateView = ({ onBack, onCreated }: Props) => {
    const methods = useForm<RavenWebhook>({ defaultValues: { enabled: 1, timeout: 5 } })
    const { createDoc, loading, error } = useFrappeCreateDoc()
    const { mutate } = useSWRConfig()

    const onSubmit = (data: RavenWebhook) => {
        createDoc("Raven Webhook", data).then(async (doc) => {
            toast.success(_("Webhook created"))
            methods.reset()
            // Await the list revalidation so the cache is fresh before we leave —
            // otherwise the list (unmounted here) can show stale data on return.
            await mutate(WEBHOOKS_LIST_KEY)
            if (doc) onCreated(doc.name)
        })
    }

    useSaveHotkey(() => methods.handleSubmit(onSubmit)())

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <Button type="submit" size="sm" disabled={loading}>
                            {loading && <Spinner />}
                            {loading ? _("Creating") : _("Create")}
                        </Button>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <Button
                            type="button" variant="ghost" size="sm" isIconButton
                            onClick={onBack} aria-label={_("Back to webhooks")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {_("Create a Webhook")}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <WebhookForm isEdit={false} />
                </SettingsPanelContent>
            </form>
        </FormProvider>
    )
}

export default WebhookCreateView
