import { WorkspaceFields } from '@hooks/useWorkspaces'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@components/ui/dropdown-menu'
import { Button } from '@components/ui/button'
import { EllipsisVertical, Settings } from 'lucide-react'
import LeaveWorkspaceButton from '@components/features/workspaces/LeaveWorkspaceButton'
import JoinWorkspaceButton from '@components/features/workspaces/JoinWorkspaceButton'
import _ from '@lib/translate'

type Props = {
    workspace: WorkspaceFields
    /** Opens the in-panel detail view. "Manage" is admin-only; everyone else reaches
     *  the same view (read-only) through the name link. */
    onManage?: (workspaceID: string) => void
}

const WorkspaceActions = ({ workspace, onManage }: Props) => {
    return (
        <div className='flex items-center gap-2 justify-center h-full'>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='sm' isIconButton>
                        <EllipsisVertical fontSize={16} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className='min-w-36'>
                    {workspace.is_admin && onManage ? (
                        <DropdownMenuItem onClick={() => onManage(workspace.name)}>
                            <Settings />
                            {_("Manage")}
                        </DropdownMenuItem>
                    ) : null}
                    {workspace.workspace_member_name ? <LeaveWorkspaceButton workspace={workspace} /> : <JoinWorkspaceButton workspace={workspace} />}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

    )
}

export default WorkspaceActions
