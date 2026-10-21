import { LayoutGrid } from "lucide-react"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import CreateWorkspaceButton from "@components/features/settings/panels/Workspaces/AddWorkspaceDialog"
import { WorkspaceJoinList } from "@components/features/workspaces/WorkspaceJoinList"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import { isJoinable } from "@hooks/useWorkspaceMembership"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"
import { isSetupPending } from "@utils/setup"

/**
 * Home for a user in no workspace: public workspaces to join, or an admin adds them.
 * A join or a new workspace refreshes the list, which sends "/" there.
 */
const NoWorkspace = () => {
    const { workspaces } = useWorkspaces()
    const joinable = workspaces.filter(isJoinable)

    return (
        <div className="flex h-dvh flex-col">
            <div className="flex flex-1 items-center justify-center p-4">
                {/* Setup's card covers this; its own "Create" would compete with the card's. */}
                {!isSetupPending() && (
                    <Empty>
                        <EmptyMedia>
                            <LayoutGrid />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle>{_("You're not in a workspace yet")}</EmptyTitle>
                            <EmptyDescription>
                                {joinable.length > 0 ? _("Join one below, or ask an admin to add you.") : _("Ask an admin to add you to a workspace.")}
                            </EmptyDescription>
                        </EmptyHeader>
                        {joinable.length > 0 && (
                            <WorkspaceJoinList workspaces={joinable} className="max-h-80 w-full max-w-sm overflow-y-auto text-start" />
                        )}
                        {hasRole("Raven Admin") && (
                            <EmptyContent>
                                <CreateWorkspaceButton label={_("Create a workspace")} />
                            </EmptyContent>
                        )}
                    </Empty>
                )}
            </div>
            <AppMobileFooter />
        </div>
    )
}

export default NoWorkspace
