import { DropdownMenuItem } from '@components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import _ from '@lib/translate'

/** The menu item that asks to leave; the owner of the menu renders LeaveWorkspaceDialog. */
const LeaveWorkspaceButton = ({ onSelect }: { onSelect: () => void }) => (
    <DropdownMenuItem onClick={onSelect} variant='destructive'>
        <LogOut fontSize={16} />
        {_("Leave")}
    </DropdownMenuItem>
)

export default LeaveWorkspaceButton
