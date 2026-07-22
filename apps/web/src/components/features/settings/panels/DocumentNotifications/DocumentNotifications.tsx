import { useState } from "react"
import DocumentNotificationListView from "./DocumentNotificationListView"
import DocumentNotificationCreateView from "./DocumentNotificationCreateView"
import DocumentNotificationDetailView from "./DocumentNotificationDetailView"

type View = { type: "list" } | { type: "create" } | { type: "notification"; id: string }

/** Integrations → Document Notifications. List with in-panel create/detail sub-views. */
export const DocumentNotifications = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return (
            <DocumentNotificationCreateView
                onBack={() => setView({ type: "list" })}
                onCreated={(id) => setView({ type: "notification", id })}
            />
        )
    }

    if (view.type === "notification") {
        return <DocumentNotificationDetailView notificationID={view.id} onBack={() => setView({ type: "list" })} />
    }

    return (
        <DocumentNotificationListView
            onCreate={() => setView({ type: "create" })}
            onOpen={(id) => setView({ type: "notification", id })}
        />
    )
}

export default DocumentNotifications
