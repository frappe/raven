import { useState } from "react"
import InstructionListView from "./InstructionListView"
import InstructionEditorView from "./InstructionEditorView"

type View = { type: "list" } | { type: "create" } | { type: "detail"; id: string }

/** AI → Instructions: list of instruction templates with in-panel create/detail sub-views. */
export const Instructions = () => {
    const [view, setView] = useState<View>({ type: "list" })

    if (view.type === "create") {
        return <InstructionEditorView onBack={() => setView({ type: "list" })} onSaved={(id) => setView({ type: "detail", id })} />
    }
    if (view.type === "detail") {
        return <InstructionEditorView id={view.id} onBack={() => setView({ type: "list" })} onDeleted={() => setView({ type: "list" })} />
    }
    return <InstructionListView onOpen={(id) => setView({ type: "detail", id })} onCreate={() => setView({ type: "create" })} />
}

export default Instructions
