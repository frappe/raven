import { useState } from "react"
import WebhookListView from "./WebhookListView"
import WebhookCreateView from "./WebhookCreateView"
import WebhookDetailView from "./WebhookDetailView"

type WebhookView = { type: "list" } | { type: "create" } | { type: "webhook"; id: string }

/** Integrations → Webhooks. List with in-panel create/detail sub-views. */
export const Webhooks = () => {
    const [view, setView] = useState<WebhookView>({ type: "list" })

    if (view.type === "create") {
        return (
            <WebhookCreateView
                onBack={() => setView({ type: "list" })}
                onCreated={(id) => setView({ type: "webhook", id })}
            />
        )
    }

    if (view.type === "webhook") {
        return <WebhookDetailView webhookID={view.id} onBack={() => setView({ type: "list" })} />
    }

    return (
        <WebhookListView
            onCreate={() => setView({ type: "create" })}
            onOpen={(id) => setView({ type: "webhook", id })}
        />
    )
}

export default Webhooks
