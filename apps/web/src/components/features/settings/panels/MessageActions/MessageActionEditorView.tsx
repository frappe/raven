import type { RavenMessageAction } from "@raven/types/RavenIntegrations/RavenMessageAction"
import SettingsRecordEditor from "../SettingsRecordEditor"
import { EnabledBadge, EnabledMenuItem } from "../EnabledRecord"
import { MessageActionForm } from "./MessageActionForm"
import { MESSAGE_ACTIONS_LIST_KEY } from "./MessageActionListView"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** Integrations → Message Actions editor: create mode when no id, detail/edit mode otherwise. */
const MessageActionEditorView = (props: Props) => (
    <SettingsRecordEditor<RavenMessageAction>
        {...props}
        doctype="Raven Message Action"
        listKey={MESSAGE_ACTIONS_LIST_KEY}
        createDefaults={{ enabled: 1, action: "Create Document" }}
        createTitle={_("Create a Message Action")}
        backLabel={_("Back to message actions")}
        deleteTitle={_("Delete Message Action?")}
        deleteDescription={(doc) => _("This will permanently delete {0}.", [doc.action_name])}
        deleteSuccessMessage={_("Message action deleted")}
        menu={(ctx) => <EnabledMenuItem {...ctx} />}
        badge={(doc) => <EnabledBadge doc={doc} />}
        title={(doc) => <span className="truncate">{doc.action_name}</span>}
        form={() => <MessageActionForm />}
    />
)

export default MessageActionEditorView
