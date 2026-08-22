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
import type { RavenBotInstructionTemplate } from "@raven/types/RavenAI/RavenBotInstructionTemplate"
import InstructionTemplateForm from "./InstructionTemplateForm"
import RecordActionsMenu from "../RecordActionsMenu"
import _ from "@lib/translate"

type Props = {
    /** Set for detail/edit mode; absent for create mode. */
    id?: string
    onBack: () => void
    onSaved?: (id: string) => void
    onDeleted?: () => void
}

/** AI → Instructions editor: create mode when no id, detail/edit mode otherwise. */
const InstructionEditorView = ({ id, onBack, onSaved, onDeleted }: Props) => {
    if (id) {
        return <InstructionDetail id={id} onBack={onBack} onDeleted={onDeleted ?? (() => undefined)} />
    }
    return <InstructionCreate onBack={onBack} onSaved={onSaved ?? (() => undefined)} />
}

const InstructionCreate = ({ onBack, onSaved }: { onBack: () => void; onSaved: (id: string) => void }) => {
    const { createDoc, loading, error } = useFrappeCreateDoc<RavenBotInstructionTemplate>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenBotInstructionTemplate>({ defaultValues: { template_name: "", instruction: "", dynamic_instructions: 0 } })
    const { handleSubmit } = methods

    const onSubmit = async (data: RavenBotInstructionTemplate) => {
        const doc = await createDoc("Raven Bot Instruction Template", data)
        await globalMutate("raven-instruction-templates")
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
                            onClick={onBack} aria-label={_("Back to instruction templates")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {_("Create an Instruction Template")}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <InstructionTemplateForm />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

const InstructionDetail = ({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) => {
    const { data, isLoading, error, mutate } = useFrappeGetDoc<RavenBotInstructionTemplate>("Raven Bot Instruction Template", id)

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
            {data && <InstructionDetailContent id={id} data={data} mutate={mutate} onBack={onBack} onDeleted={onDeleted} />}
        </>
    )
}

const InstructionDetailContent = ({
    id, data, mutate, onBack, onDeleted,
}: {
    id: string
    data: RavenBotInstructionTemplate
    mutate: SWRResponse<FrappeDoc<RavenBotInstructionTemplate>>["mutate"]
    onBack: () => void
    onDeleted: () => void
}) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<RavenBotInstructionTemplate>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenBotInstructionTemplate>({ defaultValues: data })
    const { handleSubmit } = methods
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0

    const onSubmit = async (formData: RavenBotInstructionTemplate) => {
        const doc = await updateDoc("Raven Bot Instruction Template", data.name, formData)
        toast.success(_("Saved"))
        methods.reset(doc)
        mutate(doc, { revalidate: false })
        await globalMutate("raven-instruction-templates")
    }

    useSaveHotkey(() => handleSubmit(onSubmit)())

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype="Raven Bot Instruction Template"
                                docName={id}
                                deleteDescription={_("This will permanently delete this instruction template.")}
                                onDeleted={async () => {
                                    await globalMutate("raven-instruction-templates")
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
                            onClick={onBack} aria-label={_("Back to instruction templates")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {data.template_name}
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <InstructionTemplateForm isEdit />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

export default InstructionEditorView
