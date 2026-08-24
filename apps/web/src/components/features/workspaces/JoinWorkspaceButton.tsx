import { DropdownMenuItem } from '@components/ui/dropdown-menu'
import { LogIn } from 'lucide-react'
import { WorkspaceFields } from '@hooks/useWorkspaces'
import { useFrappePostCall, useSWRConfig } from 'frappe-react-sdk'
import { toast } from 'sonner'

type Props = {
    workspace: WorkspaceFields
}

const JoinWorkspaceButton = ({ workspace }: Props) => {

    const { call } = useFrappePostCall('raven.api.workspaces.join_workspace')

    const { mutate } = useSWRConfig()

    const joinWorkspace = () => {
        toast.promise(call({ workspace: workspace.name }).then(() => {
            mutate('workspaces_list')
            mutate('channel_list')
        }), {
            loading: `Joining ${workspace.workspace_name} workspace...`,
            success: `You have joined ${workspace.workspace_name} workspace.`,
            // error: (error) => `There was an error while joining the workspace.\n${getErrorMessage(error)}`,
        })
    }
    return (
        <DropdownMenuItem onClick={joinWorkspace}>
            <LogIn fontSize={16} />
            Join
        </DropdownMenuItem>
    )
}

export default JoinWorkspaceButton
