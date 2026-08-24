import { useMemo } from 'react'
import { useFrappeGetCall } from 'frappe-react-sdk'
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