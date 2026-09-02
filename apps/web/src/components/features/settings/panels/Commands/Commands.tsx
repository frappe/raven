import { useState } from "react"
import CommandListView from "./CommandListView"
import CommandEditorView from "./CommandEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** AI → Commands: list of saved prompts with in-panel create/detail sub-views. */
export const Commands = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <CommandEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <CommandEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <CommandListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default Commands
