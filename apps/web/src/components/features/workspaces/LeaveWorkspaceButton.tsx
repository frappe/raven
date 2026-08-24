import { DropdownMenuItem } from '@components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import { WorkspaceFields } from '@hooks/useWorkspaces'
import { useFrappePostCall, useSWRConfig } from 'frappe-react-sdk'
import { toast } from 'sonner'

type Props = {
    workspace: WorkspaceFields
}

const LeaveWorkspaceButton = ({ workspace }: Props) => {

    const { call } = useFrappePostCall('raven.api.workspaces.leave_workspace')

    const { mutate } = useSWRConfig()

    const leaveWorkspace = () => {
        toast.promise(call({ workspace: workspace.name }).then(() => {
            mutate('workspaces_list')
            mutate('channel_list')
        }), {
            loading: `Leaving ${workspace.workspace_name} workspace...`,
            success: `You have left ${workspace.workspace_name} workspace.`,
            // error: (error) => `There was an error while leaving the workspace.\n${getErrorMessage(error)}`,
        })
    }
    return (
        <DropdownMenuItem onClick={leaveWorkspace} variant='destructive'>
            <LogOut fontSize={16} />
            Leave
        </DropdownMenuItem>
    )
}

export default LeaveWorkspaceButton
