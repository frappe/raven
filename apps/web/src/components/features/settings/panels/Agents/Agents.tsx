import { useState } from "react"
import AgentListView from "./AgentListView"
import AgentEditorView from "./AgentEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** AI → Agents: list of bots with in-panel create/detail sub-views. */
export const Agents = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <AgentEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <AgentEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <AgentListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default Agents
