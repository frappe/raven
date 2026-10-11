import { DropdownMenuItem } from '@components/ui/dropdown-menu'
import { LogIn } from 'lucide-react'
import { WorkspaceFields } from '@hooks/useWorkspaces'
import { useJoinWorkspace } from '@hooks/useWorkspaceMembership'
import _ from '@lib/translate'

type Props = {
    workspace: WorkspaceFields
}

const JoinWorkspaceButton = ({ workspace }: Props) => {
    const joinWorkspace = useJoinWorkspace()
    return (
        <DropdownMenuItem onClick={() => joinWorkspace(workspace).catch(() => { })}>
            <LogIn fontSize={16} />
            {_("Join")}
        </DropdownMenuItem>
    )
}

export default JoinWorkspaceButton
