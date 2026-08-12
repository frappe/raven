import { BellDotIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Integrations → Document Notifications. TODO: list + create document notifications. */
export const DocumentNotifications = () => (
    <PlaceholderPanel
        title={_("Document Notifications")}
        description={_("Configure alerts to be sent to users or channels when documents are updated in the system.")}
        icon={BellDotIcon}
        emptyTitle={_("Stay in the Loop")}
        emptyDescription={_("Send messages to channels or users based on document activity in your ERP system. Keep your team informed about important changes in real-time with rich document previews.")}
    />
)

export default DocumentNotifications
