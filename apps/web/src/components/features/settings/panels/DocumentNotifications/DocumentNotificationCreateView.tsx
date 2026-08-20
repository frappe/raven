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
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import _ from "@lib/translate"
import { useSaveHotkey } from "@hooks/useSaveHotkey"
import { DocumentNotificationForm } from "./DocumentNotificationForm"
import { DOC_NOTIFICATIONS_LIST_KEY } from "./DocumentNotificationListView"

type Props = { onBack: () => void; onCreated: (id: string) => void }

/** In-panel "create a document notification" sub-view. */
const DocumentNotificationCreateView = ({ onBack, onCreated }: Props) => {
    const methods = useForm<RavenDocumentNotification>({ defaultValues: { enabled: 1 } })
    const { createDoc, loading, error } = useFrappeCreateDoc<RavenDocumentNotification>()
    const { mutate } = useSWRConfig()

    const onSubmit = (data: RavenDocumentNotification) => {
        createDoc("Raven Document Notification", data).then(async (doc) => {
            toast.success(_("Notification created"))
            methods.reset()
            await mutate(DOC_NOTIFICATIONS_LIST_KEY)
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
                        <Button type="button" variant="ghost" size="sm" isIconButton onClick={onBack} aria-label={_("Back to notifications")}>
                            <ArrowLeftIcon />
                        </Button>
                        {_("Create a Document Notification")}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <DocumentNotificationForm />
                </SettingsPanelContent>
            </form>
        </FormProvider>
    )
}

export default DocumentNotificationCreateView
