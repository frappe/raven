import { useFrappeGetDoc, useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import {
    SettingsPanelContent, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import _ from "@lib/translate"
import { useSaveHotkey } from "@hooks/useSaveHotkey"
import { RecordActionsMenu } from "../RecordActionsMenu"
import { DocumentNotificationForm } from "./DocumentNotificationForm"
import { DOC_NOTIFICATIONS_LIST_KEY } from "./DocumentNotificationListView"

type Props = { notificationID: string; onBack: () => void }

/** In-panel view/edit of an existing document notification. */
const DocumentNotificationDetailView = ({ notificationID, onBack }: Props) => {
    const { data, error, isLoading, mutate } = useFrappeGetDoc<RavenDocumentNotification>(
        "Raven Document Notification", notificationID,
    )

    return (
        <>
            {error && <SettingsPanelContent><ErrorBanner error={error} /></SettingsPanelContent>}
            {isLoading && <SettingsPanelContent className="items-center justify-center"><Spinner /></SettingsPanelContent>}
            {data && <DetailContent key={data.name} data={data} mutate={() => { void mutate() }} onBack={onBack} />}
        </>
    )
}

const DetailContent = ({
    data, mutate, onBack,
}: { data: RavenDocumentNotification; mutate: () => void; onBack: () => void }) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<RavenDocumentNotification>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenDocumentNotification>({ defaultValues: data })
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0

    const onSubmit = (formData: RavenDocumentNotification) => {
        updateDoc("Raven Document Notification", formData.name, formData).then((doc) => {
            toast.success(_("Saved"))
            mutate()
            globalMutate(DOC_NOTIFICATIONS_LIST_KEY)
            if (doc) methods.reset(doc)
        })
    }

    useSaveHotkey(() => methods.handleSubmit(onSubmit)())

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype="Raven Document Notification"
                                docName={data.name}
                                deleteDescription={_("Are you sure you want to delete this notification?")}
                                deleteSuccessMessage={_("Notification deleted")}
                                onDeleted={() => { globalMutate(DOC_NOTIFICATIONS_LIST_KEY); onBack() }}
                            />
                            <Button type="submit" size="sm" disabled={loading}>
                                {loading && <Spinner />}
                                {loading ? _("Saving") : _("Save")}
                            </Button>
                        </div>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <Button type="button" variant="ghost" size="sm" isIconButton onClick={onBack} aria-label={_("Back to notifications")}>
                            <ArrowLeftIcon />
                        </Button>
                        <span className="truncate">{data.name}</span>
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <DocumentNotificationForm isEdit />
                </SettingsPanelContent>
            </form>
        </FormProvider>
    )
}

export default DocumentNotificationDetailView
