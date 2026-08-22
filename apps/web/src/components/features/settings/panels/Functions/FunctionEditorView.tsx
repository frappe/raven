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
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import FunctionForm from "./FunctionForm"
import RecordActionsMenu from "../RecordActionsMenu"
import _ from "@lib/translate"

type Props = {
    /** Set for detail/edit mode; absent for create mode. */
    id?: string
    onBack: () => void
    onSaved?: (id: string) => void
    onDeleted?: () => void
}

/** AI → Functions editor: create mode when no id, detail/edit mode otherwise. */
const FunctionEditorView = ({ id, onBack, onSaved, onDeleted }: Props) => {
    if (id) {
        return <FunctionDetail id={id} onBack={onBack} onDeleted={onDeleted ?? (() => undefined)} />
    }
    return <FunctionCreate onBack={onBack} onSaved={onSaved ?? (() => undefined)} />
}

const FunctionCreate = ({ onBack, onSaved }: { onBack: () => void; onSaved: (id: string) => void }) => {
    const { createDoc, loading, error } = useFrappeCreateDoc<RavenAIFunction>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenAIFunction>({
        defaultValues: { function_name: "", description: "", reference_doctype: "", function_path: "", params: { type: "object", properties: {} } },
    })
    const { handleSubmit } = methods

    const onSubmit = async (data: RavenAIFunction) => {
        const doc = await createDoc("Raven AI Function", data)
        await globalMutate("raven-ai-functions")
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
                            onClick={onBack} aria-label={_("Back to functions")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {_("Create a Function")}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <FunctionForm />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

const FunctionDetail = ({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) => {
    const { data, isLoading, error, mutate } = useFrappeGetDoc<RavenAIFunction>("Raven AI Function", id)

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
            {data && <FunctionDetailContent id={id} data={data} mutate={mutate} onBack={onBack} onDeleted={onDeleted} />}
        </>
    )
}

const FunctionDetailContent = ({
    id, data, mutate, onBack, onDeleted,
}: {
    id: string
    data: RavenAIFunction
    mutate: SWRResponse<FrappeDoc<RavenAIFunction>>["mutate"]
    onBack: () => void
    onDeleted: () => void
}) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<RavenAIFunction>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenAIFunction>({ defaultValues: data })
    const { handleSubmit } = methods
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0

    const onSubmit = async (formData: RavenAIFunction) => {
        const doc = await updateDoc("Raven AI Function", data.name, formData)
        toast.success(_("Saved"))
        methods.reset(doc)
        mutate(doc, { revalidate: false })
        await globalMutate("raven-ai-functions")
    }

    useSaveHotkey(() => handleSubmit(onSubmit)())

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype="Raven AI Function"
                                docName={id}
                                deleteDescription={_("This will permanently delete this function.")}
                                onDeleted={async () => {
                                    await globalMutate("raven-ai-functions")
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
                            onClick={onBack} aria-label={_("Back to functions")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {data.name}
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <FunctionForm isEdit />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

export default FunctionEditorView
