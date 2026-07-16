import { IdCardIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Integrations → Document Previews. TODO: customise document link previews. */
export const DocumentPreviews = () => (
    <PlaceholderPanel
        title={_("Document Previews")}
        description={_("Customise how document links are displayed in the chat. You can add/remove fields to be displayed in the preview.")}
        icon={IdCardIcon}
        emptyDescription={_("Choose the fields shown when a Frappe document link is previewed in the chat.")}
    />
)

export default DocumentPreviews
