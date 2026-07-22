import { useState } from "react"
import MessageActionListView from "./MessageActionListView"
import MessageActionCreateView from "./MessageActionCreateView"
import MessageActionDetailView from "./MessageActionDetailView"

type View = { type: "list" } | { type: "create" } | { type: "action"; id: string }

/** Integrations → Message Actions. List with in-panel create/detail sub-views. */
export const MessageActions = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return (
            <MessageActionCreateView
                onBack={() => setView({ type: "list" })}
                onCreated={(id) => setView({ type: "action", id })}
            />
        )
    }

    if (view.type === "action") {
        return <MessageActionDetailView actionID={view.id} onBack={() => setView({ type: "list" })} />
    }

    return (
        <MessageActionListView
            onCreate={() => setView({ type: "create" })}
            onOpen={(id) => setView({ type: "action", id })}
        />
    )
}

export default MessageActions
