import { WorkspaceLogo } from "@components/channel-sidebar/ChannelSidebar"
import { useLongPress } from "@hooks/useLongPress"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import { cn } from "@lib/utils"

/** One workspace in the workspaces drawer's grid: tap opens it, a long-press shows its options. */
export const WorkspaceTile = ({ workspace, isCurrent, hasUnread, onOpen, onLongPress }: {
    workspace: WorkspaceFields
    isCurrent: boolean
    hasUnread: boolean
    onOpen: () => void
    onLongPress: () => void
}) => {
    const { handlers, consumeLongPress } = useLongPress(onLongPress)
    return (
        <button
            type="button"
            {...handlers}
            // The finger lifting after a long-press still clicks: that click must not open the workspace.
            onClick={() => { if (!consumeLongPress()) onOpen() }}
            className="flex w-full select-none flex-col items-center gap-2 rounded-lg px-1 py-2 [-webkit-touch-callout:none] active:bg-surface-gray-2"
        >
            <span className="relative">
                <WorkspaceLogo
                    workspace={workspace}
                    className={cn(
                        "size-12 rounded-lg text-base",
                        isCurrent && "ring ring-outline-gray-2 ring-offset-1 ring-offset-surface-elevation-1",
                    )}
                />
                {/* Same ambient signal as the Home tab: a dot, not a count. */}
                {hasUnread && (
                    <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-surface-red-6 ring-2 ring-surface-elevation-1" aria-hidden="true" />
                )}
            </span>
            <span className="w-full text-center text-xs leading-snug text-ink-gray-6 line-clamp-2 break-words">
                {workspace.workspace_name}
            </span>
        </button>
    )
}
