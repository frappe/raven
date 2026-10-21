import { useState } from "react"
import { Button } from "@components/ui/button"
import { WorkspaceLogo } from "@components/channel-sidebar/ChannelSidebar"
import { useJoinWorkspace } from "@hooks/useWorkspaceMembership"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import _ from "@lib/translate"

/** Workspaces with a Join button each. `onJoined` runs once the workspace lists show the join. */
export const WorkspaceJoinList = ({ workspaces, onJoined, ...listProps }: {
    workspaces: WorkspaceFields[]
    onJoined?: (workspace: WorkspaceFields) => void
} & Omit<React.ComponentProps<"ul">, "children">) => {
    const joinWorkspace = useJoinWorkspace()
    // One join at a time: the joined workspace opens right after.
    const [joining, setJoining] = useState<string | null>(null)

    const join = (workspace: WorkspaceFields) => {
        setJoining(workspace.name)
        joinWorkspace(workspace)
            .then(() => onJoined?.(workspace))
            .catch(() => { })
            .finally(() => setJoining(null))
    }

    return (
        <ul {...listProps}>
            {workspaces.map((workspace) => (
                <li key={workspace.name} className="flex items-center gap-3 rounded-md px-2 py-2.5">
                    <WorkspaceLogo workspace={workspace} className="size-10 shrink-0 rounded-lg text-base" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base-medium text-ink-gray-8">{workspace.workspace_name}</p>
                        {workspace.description && (
                            <p className="line-clamp-2 text-p-sm text-ink-gray-5">{workspace.description}</p>
                        )}
                    </div>
                    <Button
                        variant="subtle"
                        size="md"
                        loading={joining === workspace.name}
                        disabled={joining !== null}
                        onClick={() => join(workspace)}
                    >
                        {_("Join")}
                    </Button>
                </li>
            ))}
        </ul>
    )
}
