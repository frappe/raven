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
import type { RavenMessageAction } from "@raven/types/RavenIntegrations/RavenMessageAction"
import _ from "@lib/translate"
import type { MessageActionFormData } from "./types"
import { RecordActionsMenu } from "../RecordActionsMenu"
import { MessageActionForm } from "./MessageActionForm"
import { MESSAGE_ACTIONS_LIST_KEY } from "./MessageActionListView"

type Props = { actionID: string; onBack: () => void }

/** In-panel view/edit of an existing message action. */
const MessageActionDetailView = ({ actionID, onBack }: Props) => {
    const { data, error, isLoading, mutate } = useFrappeGetDoc<RavenMessageAction>("Raven Message Action", actionID)

    return (
        <>
            {error && <SettingsPanelContent><ErrorBanner error={error} /></SettingsPanelContent>}
            {isLoading && <SettingsPanelContent className="items-center justify-center"><Spinner /></SettingsPanelContent>}
            {data && <MessageActionDetailContent key={data.name} data={data} mutate={() => { void mutate() }} onBack={onBack} />}
        </>
    )
}

const MessageActionDetailContent = ({
    data, mutate, onBack,
}: { data: RavenMessageAction; mutate: () => void; onBack: () => void }) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<RavenMessageAction>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<MessageActionFormData>({ defaultValues: data as MessageActionFormData })
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0

    const onSubmit = (formData: MessageActionFormData) => {
        updateDoc("Raven Message Action", formData.name, formData).then((doc) => {
            toast.success(_("Saved"))
            mutate()
            globalMutate(MESSAGE_ACTIONS_LIST_KEY)
            if (doc) methods.reset(doc)
        })
    }

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype="Raven Message Action"
                                docName={data.name}
                                deleteDescription={_("Are you sure you want to delete this message action?")}
                                deleteSuccessMessage={_("Message action deleted")}
                                onDeleted={() => { globalMutate(MESSAGE_ACTIONS_LIST_KEY); onBack() }}
                            />
                            <Button type="submit" size="sm" disabled={loading}>
                                {loading && <Spinner />}
                                {loading ? _("Saving") : _("Save")}
                            </Button>
                        </div>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <Button type="button" variant="ghost" size="sm" isIconButton onClick={onBack} aria-label={_("Back to message actions")}>
                            <ArrowLeftIcon />
                        </Button>
                        <span className="truncate">{data.action_name}</span>
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <MessageActionForm />
                </SettingsPanelContent>
            </form>
        </FormProvider>
    )
}

export default MessageActionDetailView
