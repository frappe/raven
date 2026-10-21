import { useState } from "react"
import MessageActionListView from "./MessageActionListView"
import MessageActionEditorView from "./MessageActionEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** Integrations → Message Actions: list of actions with in-panel create/detail sub-views. */
export const MessageActions = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <MessageActionEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <MessageActionEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <MessageActionListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default MessageActions
