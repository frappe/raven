import SettingsRecordEditor from "../SettingsRecordEditor"
import { EnabledBadge, EnabledMenuItem } from "../EnabledRecord"
import { SCHEDULED_MESSAGES_LIST_KEY } from "./ScheduledMessageListView"
import { ScheduledMessageForm } from "./ScheduledMessageForm"
import { CRON_DEFAULTS, fromForm, toForm, type ScheduledMessageForm as FormValues } from "./cronSchedule"
import _ from "@lib/translate"

type Props = { id?: string; onBack: () => void; onSaved?: (id: string) => void; onDeleted?: () => void }

/** Integrations → Scheduled Messages editor: create mode when no id, detail/edit mode otherwise. */
const ScheduledMessageEditorView = (props: Props) => (
    <SettingsRecordEditor<FormValues>
        {...props}
        doctype="Raven Scheduler Event"
        listKey={SCHEDULED_MESSAGES_LIST_KEY}
        createDefaults={{ disabled: 0, send_to: "Channel", event_frequency: "Every Day", ...CRON_DEFAULTS }}
        createTitle={_("Create a Scheduled Message")}
        backLabel={_("Back to scheduled messages")}
        deleteTitle={_("Delete Scheduled Message?")}
        deleteDescription={(doc) => _("This will permanently delete {0}.", [doc.event_name])}
        deleteSuccessMessage={_("Scheduled message deleted")}
        title={(doc) => <span className="truncate">{doc.event_name}</span>}
        menu={(ctx) => <EnabledMenuItem {...ctx} field="disabled" />}
        badge={(doc) => <EnabledBadge doc={doc} field="disabled" />}
        toForm={toForm}
        fromForm={fromForm}
        form={(isEdit) => <ScheduledMessageForm isEdit={isEdit} />}
    />
)

export default ScheduledMessageEditorView
