import { useState } from "react"
import WorkspaceListView from "./WorkspaceListView"
import WorkspaceDetailView from "./WorkspaceDetailView"

type WorkspaceView = { type: "list" } | { type: "workspace"; id: string }

/** Workspace settings — list of workspaces with an in-panel detail sub-view. */
export const Workspaces = () => {
    const [view, setView] = useState<WorkspaceView>({ type: "list" })

    if (view.type === "workspace") {
        return (
            <WorkspaceDetailView
                workspaceID={view.id}
                onBack={() => setView({ type: "list" })}
            />
        )
    }

    return <WorkspaceListView onOpenWorkspace={(id) => setView({ type: "workspace", id })} />
}

export default Workspaces
