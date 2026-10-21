import { useState } from "react"
import ScheduledMessageListView from "./ScheduledMessageListView"
import ScheduledMessageEditorView from "./ScheduledMessageEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** Integrations → Scheduled Messages: list with in-panel create/detail sub-views. */
export const ScheduledMessages = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <ScheduledMessageEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <ScheduledMessageEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <ScheduledMessageListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default ScheduledMessages
