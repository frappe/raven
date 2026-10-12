import { useMemo } from 'react'
import { useFrappeGetCall, useFrappeUpdateDoc } from 'frappe-react-sdk'
import useCurrentRavenUser from '@raven/lib/hooks/useCurrentRavenUser'
import { RavenWorkspace } from '@raven/types/Raven/RavenWorkspace'

export type WorkspaceFields = Pick<RavenWorkspace, 'name' | 'workspace_name' | 'logo' | 'type' | 'can_only_join_via_invite' | 'description'> & {
    workspace_member_name?: string
    is_admin?: 0 | 1
}

export const useWorkspaces = () => {
    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: WorkspaceFields[] }>('raven.api.workspaces.get_list', undefined, 'workspaces_list', {
        revalidateOnFocus: false,
        keepPreviousData: true
    })

    // Resolve logos once and keep a stable array reference between fetches
    const workspaces = useMemo(
        () => (data?.message ?? []).map((workspace) => ({ ...workspace, logo: workspace.logo || '' })),
        [data?.message]
    )

    return { workspaces, error, isLoading, mutate }
}

/**
 * The workspaces the user is a member of, in their chosen order: the profile's
 * pinned_workspaces rows first (in row order), the rest in server order — so
 * joining a new workspace never needs a migration, it just appends until the
 * next reorder writes the full order.
 */
export const useMyWorkspaces = () => {
    const { workspaces } = useWorkspaces()
    const { myProfile } = useCurrentRavenUser()
    return useMemo(() => {
        const members = workspaces.filter((workspace) => workspace.workspace_member_name)
        const position = new Map((myProfile?.pinned_workspaces ?? []).map((row, index) => [row.workspace, index]))
        if (position.size === 0) return members
        return [...members].sort((a, b) => (position.get(a.name) ?? Infinity) - (position.get(b.name) ?? Infinity))
    }, [workspaces, myProfile?.pinned_workspaces])
}

/**
 * Saves a full workspace order to the profile's pinned_workspaces table.
 * Optimistic: the ordered lists read from the profile, so the profile is
 * patched locally first and reverted to server truth if the save fails.
 */
export const useSaveWorkspaceOrder = () => {
    const { myProfile, mutate } = useCurrentRavenUser()
    const { updateDoc } = useFrappeUpdateDoc()
    return (ordered: WorkspaceFields[]) => {
        if (!myProfile) return
        const order = ordered.map((workspace) => ({ workspace: workspace.name }))
        mutate({ message: { ...myProfile, pinned_workspaces: order } as typeof myProfile }, { revalidate: false })
        updateDoc("Raven User", myProfile.name, { pinned_workspaces: order }).catch(() => mutate())
    }
}