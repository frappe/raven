import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import SettingsRecordEditor from "../SettingsRecordEditor"
import { EnabledBadge, EnabledMenuItem } from "../EnabledRecord"
import { DocumentNotificationForm } from "./DocumentNotificationForm"
import { DOC_NOTIFICATIONS_LIST_KEY } from "./DocumentNotificationListView"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** Integrations → Document Notifications editor: create mode when no id, detail/edit mode otherwise. */
const DocumentNotificationEditorView = (props: Props) => (
    <SettingsRecordEditor<RavenDocumentNotification>
        {...props}
        doctype="Raven Document Notification"
        listKey={DOC_NOTIFICATIONS_LIST_KEY}
        createDefaults={{ enabled: 1 }}
        createTitle={_("Create a Document Notification")}
        backLabel={_("Back to notifications")}
        deleteTitle={_("Delete Document Notification?")}
        deleteDescription={(doc) => _("This will permanently delete {0}.", [doc.notification_name])}
        deleteSuccessMessage={_("Notification deleted")}
        menu={(ctx) => <EnabledMenuItem {...ctx} />}
        badge={(doc) => <EnabledBadge doc={doc} />}
        title={(doc) => <span className="truncate">{doc.name}</span>}
        form={(isEdit) => <DocumentNotificationForm isEdit={isEdit} />}
    />
)

export default DocumentNotificationEditorView
