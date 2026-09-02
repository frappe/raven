import { AGENTS_LIST_KEY } from "./AgentListView"
import { useContext } from "react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import { useNavigate } from "react-router"
import { useSetAtom } from "jotai"
import { toast } from "sonner"
import { ExternalLinkIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { settingsDialogOpenTab } from "@components/features/settings/settingsDialogAtom"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import SettingsRecordEditor from "../SettingsRecordEditor"
import AgentForm from "./AgentForm"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** AI → Agents editor: create mode when no id, detail/edit mode otherwise. */
const AgentEditorView = (props: Props) => (
    <SettingsRecordEditor<RavenBot>
        {...props}
        doctype="Raven Bot"
        listKey={AGENTS_LIST_KEY}
        createDefaults={{ bot_name: "", description: "", is_ai_bot: 0, enable_file_search: 1, enable_code_interpreter: 1 }}
        createTitle={_("Create an Agent")}
        backLabel={_("Back to agents")}
        deleteDescription={_("This will permanently delete this agent.")}
        title={(doc) => <span className="truncate max-w-[24rem]">{doc.bot_name}</span>}
        actions={(doc) => <OpenChatButton bot={doc} />}
        form={(isEdit) => <AgentForm isEdit={isEdit} />}
    />
)

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
