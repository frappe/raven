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
import _ from "@lib/translate"
import type { MessageActionFormData } from "./types"
import { MessageActionForm } from "./MessageActionForm"
import { useSaveHotkey } from "@hooks/useSaveHotkey"
import { MESSAGE_ACTIONS_LIST_KEY } from "./MessageActionListView"

type Props = { onBack: () => void; onCreated: (id: string) => void }

/** In-panel "create a message action" sub-view. */
const MessageActionCreateView = ({ onBack, onCreated }: Props) => {
    const methods = useForm<MessageActionFormData>({ defaultValues: { enabled: 1, action: "Create Document" } })
    const { createDoc, loading, error } = useFrappeCreateDoc<MessageActionFormData>()
    const { mutate } = useSWRConfig()

    const onSubmit = (data: MessageActionFormData) => {
        createDoc("Raven Message Action", data).then(async (doc) => {
            toast.success(_("Message action created"))
            methods.reset()
            // Await the list revalidation so the cache is fresh before we leave —
            // otherwise the list (unmounted here) can show stale data on return.
            await mutate(MESSAGE_ACTIONS_LIST_KEY)
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
                        <Button type="button" variant="ghost" size="sm" isIconButton onClick={onBack} aria-label={_("Back to message actions")}>
                            <ArrowLeftIcon />
                        </Button>
                        {_("Create a Message Action")}
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

export default MessageActionCreateView
