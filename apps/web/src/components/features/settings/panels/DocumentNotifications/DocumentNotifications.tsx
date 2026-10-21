import { useState } from "react"
import DocumentNotificationListView from "./DocumentNotificationListView"
import DocumentNotificationEditorView from "./DocumentNotificationEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** Integrations → Document Notifications: list of notifications with in-panel create/detail sub-views. */
export const DocumentNotifications = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <DocumentNotificationEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <DocumentNotificationEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <DocumentNotificationListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default DocumentNotifications
