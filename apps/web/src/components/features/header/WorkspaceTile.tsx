import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Minus } from "lucide-react"
import { Button } from "@components/ui/button"
import { WorkspaceLogo } from "@components/channel-sidebar/ChannelSidebar"
import { useLongPress } from "@hooks/useLongPress"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * One workspace in the workspaces drawer's grid. Tap opens it; a long-press
 * starts EDIT MODE — the iOS home-screen idiom: every tile jiggles and grows a
 * remove badge, and dragging a tile reorders the grid. The drawer owns the
 * mode and the DndContext; this tile is one sortable item inside it.
 */
export const WorkspaceTile = ({ workspace, index, isCurrent, hasUnread, editing, onOpen, onEdit, onRemove }: {
    workspace: WorkspaceFields
    index: number
    isCurrent: boolean
    hasUnread: boolean
    editing: boolean
    onOpen: () => void
    onEdit: () => void
    onRemove: () => void
}) => {
    const { handlers, consumeLongPress } = useLongPress(onEdit)
    // Sortable only while editing — in normal mode a touch-drag must stay a scroll.
    const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: workspace.name,
        disabled: !editing,
    })

    return (
        // Two layers of transform that must not meet on one element: the
        // outer div carries the sortable's reflow transform, the inner one
        // carries the jiggle keyframe.
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(isDragging && "z-10")}
        >
            <div
                className={cn("relative", editing && !isDragging && "animate-tile-jiggle")}
                // Tiles out of phase with each other, like the real thing — a
                // negative delay starts each one mid-cycle.
                style={editing ? { animationDelay: `${(index % 4) * -83}ms` } : undefined}
            >
                <button
                    type="button"
                    {...(editing ? listeners : handlers)}
                    // Suppressed in BOTH modes: the long-press that enters edit mode and
                    // the still hold that starts a drag both raise the OS context menu.
                    onContextMenu={(event) => event.preventDefault()}
                    // The finger lifting after a long-press still clicks: that click must
                    // not open the workspace. In edit mode taps do nothing — Done ends it.
                    onClick={() => { if (!consumeLongPress() && !editing) onOpen() }}
                    className={cn(
                        "flex w-full select-none flex-col items-center gap-2 rounded-lg px-1 py-2 [-webkit-touch-callout:none]",
                        // touch-none hands the whole touch to the drag sensor;
                        // the press tint reads wrong on a tile that is a handle.
                        editing ? "touch-none" : "active:bg-surface-gray-2",
                        isDragging && "opacity-80",
                    )}
                >
                    <span className="relative">
                        <WorkspaceLogo
                            workspace={workspace}
                            className={cn(
                                "size-12 rounded-lg text-base",
                                // The ring marks "you are here" — noise while rearranging.
                                isCurrent && !editing && "ring ring-outline-gray-2 ring-offset-1 ring-offset-surface-elevation-1",
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
                {/* A sibling of the tile button, not a child — nested buttons are
                    invalid, and the drag listeners must not swallow its tap. */}
                {editing && !isDragging && (
                    <Button
                        variant="subtle"
                        size="xs"
                        isIconButton
                        onClick={onRemove}
                        aria-label={_("Leave {0}", [workspace.workspace_name])}
                        // The ring fakes a cutout against whatever logo is underneath.
                        className="absolute left-1 top-0 size-5 rounded-full ring-2 ring-surface-elevation-1"
                    >
                        <Minus className="size-3.5" />
                    </Button>
                )}
            </div>
        </div>
    )
}
