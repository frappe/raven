import { useContext } from "react"
import { useFrappeCreateDoc, useFrappeGetDoc, useFrappeUpdateDoc, useSWRConfig, FrappeContext, type FrappeConfig, type FrappeDoc, type SWRResponse } from "frappe-react-sdk"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router"
import { useSetAtom } from "jotai"
import { toast } from "sonner"
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
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
import { settingsDialogOpenTab } from "@components/features/settings/settingsDialogAtom"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import AgentForm from "./AgentForm"
import RecordActionsMenu from "../RecordActionsMenu"
import _ from "@lib/translate"

type Props = {
    /** Set for detail/edit mode; absent for create mode. */
    id?: string
    onBack: () => void
    onSaved?: (id: string) => void
    onDeleted?: () => void
}

/** AI → Agents editor: create mode when no id, detail/edit mode otherwise. */
const AgentEditorView = ({ id, onBack, onSaved, onDeleted }: Props) => {
    if (id) {
        return <AgentDetail id={id} onBack={onBack} onDeleted={onDeleted ?? (() => undefined)} />
    }
    return <AgentCreate onBack={onBack} onSaved={onSaved ?? (() => undefined)} />
}

const AgentCreate = ({ onBack, onSaved }: { onBack: () => void; onSaved: (id: string) => void }) => {
    const { createDoc, loading, error } = useFrappeCreateDoc<RavenBot>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenBot>({
        defaultValues: { bot_name: "", description: "", is_ai_bot: 0, enable_file_search: 1, enable_code_interpreter: 1 },
    })
    const { handleSubmit } = methods

    const onSubmit = async (data: RavenBot) => {
        const doc = await createDoc("Raven Bot", data)
        await globalMutate("raven-bots")
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
                            onClick={onBack} aria-label={_("Back to agents")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {_("Create an Agent")}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <AgentForm />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

const AgentDetail = ({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) => {
    const { data, isLoading, error, mutate } = useFrappeGetDoc<RavenBot>("Raven Bot", id)

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
            {data && <AgentDetailContent id={id} data={data} mutate={mutate} onBack={onBack} onDeleted={onDeleted} />}
        </>
    )
}

const AgentDetailContent = ({
    id, data, mutate, onBack, onDeleted,
}: {
    id: string
    data: RavenBot
    mutate: SWRResponse<FrappeDoc<RavenBot>>["mutate"]
    onBack: () => void
    onDeleted: () => void
}) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<RavenBot>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<RavenBot>({ defaultValues: data })
    const { handleSubmit } = methods
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0

    const onSubmit = async (formData: RavenBot) => {
        const doc = await updateDoc("Raven Bot", data.name, formData)
        toast.success(_("Saved"))
        methods.reset(doc)
        mutate(doc, { revalidate: false })
        await globalMutate("raven-bots")
    }

    useSaveHotkey(() => handleSubmit(onSubmit)())

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype="Raven Bot"
                                docName={id}
                                deleteDescription={_("This will permanently delete this agent.")}
                                onDeleted={async () => {
                                    await globalMutate("raven-bots")
                                    onDeleted()
                                }}
                            />
                            <OpenChatButton bot={data} />
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
                            onClick={onBack} aria-label={_("Back to agents")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        <span className="truncate max-w-[24rem]">{data.bot_name}</span>
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <AgentForm isEdit />
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

/** Opens the direct-message chat with the bot, closing the settings dialog first. */
const OpenChatButton = ({ bot }: { bot: RavenBot }) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const navigate = useNavigate()
    const setOpenTab = useSetAtom(settingsDialogOpenTab)

    const openChat = () => {
        call.post("raven.api.raven_channel.create_direct_message_channel", { user_id: bot.raven_user })
            .then((res: { message: string }) => {
                setOpenTab("")
                navigate(`/dm-channel/${encodeURIComponent(res.message)}`)
            })
            .catch(() => toast.error(_("Failed to create chat channel")))
    }

    return (
        <Button type="button" variant="outline" size="sm" onClick={openChat}>
            {_("Open Chat")}
            <ExternalLinkIcon />
        </Button>
    )
}

export default AgentEditorView
