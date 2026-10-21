import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import SettingsRecordEditor from "../SettingsRecordEditor"
import { EnabledBadge, EnabledMenuItem } from "../EnabledRecord"
import { WebhookForm } from "./WebhookForm"
import { WEBHOOKS_LIST_KEY } from "./WebhookListView"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** Integrations → Webhooks editor: create mode when no id, detail/edit mode otherwise. */
const WebhookEditorView = (props: Props) => (
    <SettingsRecordEditor<RavenWebhook>
        {...props}
        doctype="Raven Webhook"
        listKey={WEBHOOKS_LIST_KEY}
        createDefaults={{ enabled: 1, timeout: 5 }}
        createTitle={_("Create a Webhook")}
        backLabel={_("Back to webhooks")}
        deleteTitle={_("Delete Webhook?")}
        deleteDescription={(doc) => _("This will permanently delete {0}.", [doc.name])}
        deleteSuccessMessage={_("Webhook deleted")}
        menu={(ctx) => <EnabledMenuItem {...ctx} />}
        badge={(doc) => <EnabledBadge doc={doc} />}
        title={(doc) => <span className="truncate">{doc.name}</span>}
        form={(isEdit) => <WebhookForm isEdit={isEdit} />}
    />
)

export default WebhookEditorView
