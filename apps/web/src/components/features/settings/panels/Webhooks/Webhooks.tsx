import { useState } from "react"
import WebhookListView from "./WebhookListView"
import WebhookEditorView from "./WebhookEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** Integrations → Webhooks: list of webhooks with in-panel create/detail sub-views. */
export const Webhooks = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <WebhookEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <WebhookEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <WebhookListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default Webhooks
