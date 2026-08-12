import { WebhookIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Integrations → Webhooks. TODO: list + create webhooks. */
export const Webhooks = () => (
    <PlaceholderPanel
        title={_("Webhooks")}
        description={_("Fire webhooks on specific events like when a message is sent or channel is created.")}
        icon={WebhookIcon}
        emptyTitle={_("Webhooks")}
        emptyDescription={_("Webhooks allow you to receive HTTP requests whenever a specific event occurs - like when a message is sent or a channel is created.")}
    />
)

export default Webhooks
