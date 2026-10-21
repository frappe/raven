import type { WorkspaceFields } from "@hooks/useWorkspaces"

/**
 * Where "/" lands. The remembered workspace only counts while the user is still
 * a member; desktop reopens the exact channel, mobile the workspace's list.
 * Null when the user is in no workspace.
 */
export const getIndexTarget = ({ lastWorkspace, lastChannel, workspaces, isMobile }: {
    lastWorkspace: string
    lastChannel: string
    workspaces: WorkspaceFields[]
    isMobile: boolean
}): string | null => {
    const memberOf = workspaces.filter((workspace) => workspace.workspace_member_name)

    if (lastWorkspace && memberOf.some((workspace) => workspace.name === lastWorkspace)) {
        const base = `/${encodeURIComponent(lastWorkspace)}`
        return lastChannel && !isMobile ? `${base}/${encodeURIComponent(lastChannel)}` : base
    }

    return memberOf[0] ? `/${encodeURIComponent(memberOf[0].name)}` : null
}
