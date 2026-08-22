import type { RavenBotInstructionTemplate } from "@raven/types/RavenAI/RavenBotInstructionTemplate"
import SettingsRecordEditor from "../SettingsRecordEditor"
import InstructionTemplateForm from "./InstructionTemplateForm"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** AI → Instructions editor: create mode when no id, detail/edit mode otherwise. */
const InstructionEditorView = (props: Props) => (
    <SettingsRecordEditor<RavenBotInstructionTemplate>
        {...props}
        doctype="Raven Bot Instruction Template"
        listKey="raven-instruction-templates"
        createDefaults={{ template_name: "", instruction: "", dynamic_instructions: 0 }}
        createTitle={_("Create an Instruction Template")}
        backLabel={_("Back to instruction templates")}
        deleteDescription={_("This will permanently delete this instruction template.")}
        title={(doc) => doc.template_name}
        form={(isEdit) => <InstructionTemplateForm isEdit={isEdit} />}
    />
)

export default InstructionEditorView
