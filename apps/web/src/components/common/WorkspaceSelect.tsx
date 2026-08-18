import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@components/ui/select"
import _ from "@lib/translate"
import { WorkspaceFields } from "@hooks/useWorkspaces"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { cn } from "@lib/utils"

/**
 * Workspace picker: a Select whose options render the workspace logo + name.
 * Shared by the Channels settings filter and the Customize Sidebar dialog so a
 * workspace can be chosen even on routes that carry no `:workspaceID`.
 */
export const WorkspaceSelect = ({
    value,
    onValueChange,
    workspaces,
    className,
}: {
    value: string
    onValueChange: (value: string) => void
    workspaces: WorkspaceFields[],
    className?: string
}) => {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger
                inputSize="sm"
                // No padding override: this sits in a filter row beside plain selects, and
                // tightening it to 2px/4px made the logo look jammed against the border while
                // its text-only neighbours kept the trigger's standard 8px.
                className={cn("w-40 shrink-0 **:data-[slot=select-value]:truncate **:data-[slot=select-value]:block", className)}
            >
                <SelectValue placeholder={_('Select a workspace')} />
            </SelectTrigger>
            <SelectContent align="start" className="min-w-56 max-w-72">
                {workspaces?.map((workspace) => (
                    <SelectItem key={workspace.name} value={workspace.name} className="h-8 px-1 *:[span]:last:min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            {/* rounded (not rounded-full) matches the workspace switcher's logos;
                                fallback shares the radius so no-logo workspaces aren't square. */}
                            <Avatar className="h-5 w-5 shrink-0 rounded-sm border border-outline-gray-2">
                                <AvatarImage src={workspace.logo} alt={workspace.workspace_name} />
                                <AvatarFallback className="rounded-sm text-xs bg-surface-gray-2 text-ink-gray-7">
                                    {workspace.workspace_name?.charAt(0)?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{workspace.workspace_name}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
