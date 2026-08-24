import { ZapIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Integrations → Message Actions. TODO: list + create message actions. */
export const MessageActions = () => (
    <PlaceholderPanel
        title={_("Message Actions")}
        description={_("Use these to add custom actions - like creating an issue/task from a message.")}
        icon={ZapIcon}
        emptyTitle={_("Actions")}
        emptyDescription={
            <>
                {_("Add actions that allow you to create documents or make API calls from the contents of a message - like creating a support ticket or project issue from a message sent in a channel.")}
                <br />
                <br />
                {_("Access them by right clicking any message and selecting")} <strong>{_("Actions")}</strong>.
            </>
        }
    />
)

export default MessageActions
