import { DrawerContent, DrawerDescription, DrawerNested, DrawerTitle } from "@components/ui/drawer"
import { WorkspaceJoinList } from "@components/features/workspaces/WorkspaceJoinList"
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
    const noDragProps = useNoDragWhileScrolled()

    return (
        <DrawerNested open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerTitle className="px-4 py-2 text-start text-2xl-semibold text-ink-gray-9">
                    {_("Join a workspace")}
                </DrawerTitle>
                <DrawerDescription className="sr-only">{_("Public workspaces you can join")}</DrawerDescription>
                <WorkspaceJoinList
                    {...noDragProps}
                    workspaces={workspaces}
                    onJoined={onJoined}
                    className="max-h-[50dvh] min-h-0 overflow-y-auto px-2 pb-4"
                />
            </DrawerContent>
        </DrawerNested>
    )
}
