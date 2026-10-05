import { useState } from "react"
import { LogOut } from "lucide-react"
import { Button } from "@components/ui/button"
import { DrawerContent, DrawerDescription, DrawerNested, DrawerTitle } from "@components/ui/drawer"
import { WorkspaceLogo } from "@components/channel-sidebar/ChannelSidebar"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import _ from "@lib/translate"

/**
 * Mobile: what a long-pressed workspace tile offers, stacked on the workspaces drawer (render it
 * inside that drawer's content); open while `workspace` is set.
 */
export const WorkspaceTileSheet = ({ workspace, onClose, onLeave }: {
    workspace: WorkspaceFields | null
    onClose: () => void
    onLeave: (workspace: WorkspaceFields) => void
}) => {
    // The last workspace pressed: the sheet keeps its header while it animates closed.
    const [shown, setShown] = useState(workspace)
    if (workspace && workspace !== shown) setShown(workspace)

    return (
        <DrawerNested open={workspace !== null} onOpenChange={(open) => { if (!open) onClose() }}>
            <DrawerContent>
                <DrawerDescription className="sr-only">{_("Workspace options")}</DrawerDescription>
                {shown && (
                    // Header and rows share one column and one row height, as in the send options sheet;
                    // px-3 lines the logo up with the row icons.
                    <div className="flex flex-col gap-1 p-3 pb-6">
                        <div className="flex h-10 items-center gap-3 px-3">
                            <WorkspaceLogo workspace={shown} className="size-5" />
                            <DrawerTitle className="truncate text-ink-gray-8">
                                {shown.workspace_name}
                            </DrawerTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="lg"
                            theme="red"
                            className="w-full justify-start gap-3 active:bg-surface-red-2"
                            onClick={() => onLeave(shown)}
                        >
                            <LogOut />
                            {_("Leave workspace")}
                        </Button>
                    </div>
                )}
            </DrawerContent>
        </DrawerNested>
    )
}
