import { COMMANDS_LIST_KEY } from "./CommandListView"
import type { RavenBotAIPrompt } from "@raven/types/RavenAI/RavenBotAIPrompt"
import SettingsRecordEditor from "../SettingsRecordEditor"
import SavedPromptForm from "./SavedPromptForm"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** AI → Commands editor: create mode when no id, detail/edit mode otherwise. */
const CommandEditorView = (props: Props) => (
    <SettingsRecordEditor<RavenBotAIPrompt>
        {...props}
        doctype="Raven Bot AI Prompt"
        listKey={COMMANDS_LIST_KEY}
        createDefaults={{ prompt: "", raven_bot: "", is_global: 0 }}
        createTitle={_("Create a Saved Command")}
        backLabel={_("Back to saved commands")}
        deleteDescription={_("This will permanently delete this saved command.")}
        title={(doc) => <span className="truncate max-w-[24rem]">{doc.prompt}</span>}
        form={(isEdit) => <SavedPromptForm isEdit={isEdit} />}
    />
)

export default CommandEditorView
