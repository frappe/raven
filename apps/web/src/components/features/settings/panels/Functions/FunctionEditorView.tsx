import { FUNCTIONS_LIST_KEY } from "./FunctionListView"
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import SettingsRecordEditor from "../SettingsRecordEditor"
import FunctionForm from "./FunctionForm"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** AI → Functions editor: create mode when no id, detail/edit mode otherwise. */
const FunctionEditorView = (props: Props) => (
    <SettingsRecordEditor<RavenAIFunction>
        {...props}
        doctype="Raven AI Function"
        listKey={FUNCTIONS_LIST_KEY}
        createDefaults={{ function_name: "", description: "", reference_doctype: "", function_path: "", params: { type: "object", properties: {} } }}
        createTitle={_("Create a Function")}
        backLabel={_("Back to functions")}
        deleteDescription={_("This will permanently delete this function.")}
        title={(doc) => doc.name}
        form={(isEdit) => <FunctionForm isEdit={isEdit} />}
    />
)

export default FunctionEditorView
