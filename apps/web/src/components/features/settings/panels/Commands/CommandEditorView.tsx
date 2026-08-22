import { useFrappeCreateDoc, useFrappeGetDoc, useFrappeUpdateDoc, useSWRConfig, type FrappeDoc, type SWRResponse } from "frappe-react-sdk"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { Form } from "@components/ui/form"
import {
    SettingsPanelContent,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Spinner } from "@components/ui/spinner"
import useSaveHotkey from "@hooks/useSaveHotkey"
import type { RavenBotAIPrompt } from "@raven/types/RavenAI/RavenBotAIPrompt"
import SavedPromptForm from "./SavedPromptForm"
import RecordActionsMenu from "../RecordActionsMenu"
import _ from "@lib/translate"

type Props = {
    /** Set for detail/edit mode; absent for create mode. */
    id?: string
    onBack: () => void
    onSaved?: (id: string) => void
    onDeleted?: () => void
}

/** AI → Commands editor: create mode when no id, detail/edit mode otherwise. */
const CommandEditorView = ({ id, onBack, onSaved, onDeleted }: Props) => {
    if (id) {
        return <CommandDetail id={id} onBack={onBack} onDeleted={onDeleted ?? (() => undefined)} />
    }
    return <CommandCreate onBack={onBack} onSaved={onSaved ?? (() => undefined)} />
}

const CommandCreate = ({ onBack, onSaved }: { onBack: () => void; onSaved: (id: string) => void }) => {
    const { createDoc, loading, error } = useFrappeCreateDoc<RavenBotAIPrompt>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenBotAIPrompt>({ defaultValues: { prompt: "", raven_bot: "", is_global: 0 } })
    const { handleSubmit } = methods

    const onSubmit = async (data: RavenBotAIPrompt) => {
        const doc = await createDoc("Raven Bot AI Prompt", data)
        await globalMutate("raven-saved-prompts")
        onSaved(doc.name)
    }

    useSaveHotkey(() => handleSubmit(onSubmit)())

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
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
                            onClick={onBack} aria-label={_("Back to saved commands")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {_("Create a Saved Command")}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <SavedPromptForm />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

const CommandDetail = ({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) => {
    const { data, isLoading, error, mutate } = useFrappeGetDoc<RavenBotAIPrompt>("Raven Bot AI Prompt", id)

    return (
        <>
            {error && (
                <SettingsPanelContent>
                    <ErrorBanner error={error} />
                </SettingsPanelContent>
            )}
            {isLoading && (
                <SettingsPanelContent className="items-center justify-center">
                    <Spinner />
                </SettingsPanelContent>
            )}
            {data && <CommandDetailContent id={id} data={data} mutate={mutate} onBack={onBack} onDeleted={onDeleted} />}
        </>
    )
}

const CommandDetailContent = ({
    id, data, mutate, onBack, onDeleted,
}: {
    id: string
    data: RavenBotAIPrompt
    mutate: SWRResponse<FrappeDoc<RavenBotAIPrompt>>["mutate"]
    onBack: () => void
    onDeleted: () => void
}) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<RavenBotAIPrompt>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenBotAIPrompt>({ defaultValues: data })
    const { handleSubmit } = methods
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0

    const onSubmit = async (formData: RavenBotAIPrompt) => {
        const doc = await updateDoc("Raven Bot AI Prompt", data.name, formData)
        toast.success(_("Saved"))
        methods.reset(doc)
        mutate(doc, { revalidate: false })
        await globalMutate("raven-saved-prompts")
    }

    useSaveHotkey(() => handleSubmit(onSubmit)())

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype="Raven Bot AI Prompt"
                                docName={id}
                                deleteDescription={_("This will permanently delete this saved command.")}
                                onDeleted={async () => {
                                    await globalMutate("raven-saved-prompts")
                                    onDeleted()
                                }}
                            />
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
                            onClick={onBack} aria-label={_("Back to saved commands")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        <span className="truncate max-w-[24rem]">{data.prompt}</span>
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <SavedPromptForm isEdit />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

export default CommandEditorView
