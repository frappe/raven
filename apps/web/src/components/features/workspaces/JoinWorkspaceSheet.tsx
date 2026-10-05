import { useState } from "react"
import { Button } from "@components/ui/button"
import { DrawerContent, DrawerDescription, DrawerNested, DrawerTitle } from "@components/ui/drawer"
import { WorkspaceLogo } from "@components/channel-sidebar/ChannelSidebar"
import { useJoinWorkspace } from "@hooks/useWorkspaceMembership"
import { useNoDragWhileScrolled } from "@hooks/useNoDragWhileScrolled"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import _ from "@lib/translate"

/**
 * Mobile: the workspaces the user can join, stacked on the workspaces drawer (render it inside
 * that drawer's content). A join opens the workspace through `onJoined`.
 */
export const JoinWorkspaceSheet = ({ open, onOpenChange, workspaces, onJoined }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaces: WorkspaceFields[]
    onJoined: (workspace: WorkspaceFields) => void
}) => {
    const joinWorkspace = useJoinWorkspace()
    const noDragProps = useNoDragWhileScrolled()
    // One join at a time: the joined workspace opens right after, closing this sheet.
    const [joining, setJoining] = useState<string | null>(null)

    const join = (workspace: WorkspaceFields) => {
        setJoining(workspace.name)
        joinWorkspace(workspace)
            .then(() => onJoined(workspace))
            .catch(() => { })
            .finally(() => setJoining(null))
    }

    return (
        <DrawerNested open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerTitle className="px-4 py-2 text-left text-2xl-semibold text-ink-gray-9">
                    {_("Join a workspace")}
                </DrawerTitle>
                <DrawerDescription className="sr-only">{_("Public workspaces you can join")}</DrawerDescription>
                <ul {...noDragProps} className="max-h-[50dvh] min-h-0 overflow-y-auto px-2 pb-4">
                    {workspaces.map((workspace) => (
                        <li key={workspace.name} className="flex items-center gap-3 rounded-md px-2 py-2.5">
                            <WorkspaceLogo workspace={workspace} className="size-10 shrink-0 rounded-lg text-base" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-base-medium text-ink-gray-8">{workspace.workspace_name}</p>
                                {workspace.description && (
                                    <p className="line-clamp-2 text-sm text-ink-gray-5">{workspace.description}</p>
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
            </DrawerContent>
        </DrawerNested>
    )
}
