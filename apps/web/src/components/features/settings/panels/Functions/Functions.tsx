import { useState } from "react"
import FunctionListView from "./FunctionListView"
import FunctionEditorView from "./FunctionEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** AI → Functions: list of declared functions with in-panel create/detail sub-views. */
export const Functions = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <FunctionEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <FunctionEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <FunctionListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default Functions
