import {
    Collapsible,
    CollapsibleContent,
} from '@components/ui/collapsible'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { ChannelSidebarData } from '@raven/lib/hooks/useGroupedChannels'
import { useEffect, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PreviewGroupHeader } from "./PreviewGroupHeader"
import { useChannelGroups } from "./useChannelGroups"

interface SidebarPreviewProps {
    data: ChannelSidebarData
    globalSort?: string
}

/** Non-interactive mirror of ChannelSidebar's layout for the customize dialog. */
export const SidebarPreview = ({ data, globalSort }: SidebarPreviewProps) => {

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
    const [scrollerRef, setScrollerRef] = useState<HTMLElement | null>(null)

    const { reorder } = useChannelGroups()
    const sensors = useSensors(
        // The whole group header is the drag activator (no grip handle), and it is
        // also the collapse toggle. The distance threshold is what separates the
        // two: a still click toggles, movement past 8px lifts. Without it every
        // pointerdown would start a drag and swallow the click.
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    useEffect(() => {
        data.groupedChannels.forEach(([groupName, channels]) => {
            if (channels.length > 0 && openGroups[groupName] === false) {
                setOpenGroups(prev => ({ ...prev, [groupName]: true }))
            }
            else if (channels.length === 0 && openGroups[groupName] === true) {
                setOpenGroups(prev => ({ ...prev, [groupName]: false }))
            }
        })
    }, [data.groupedChannels])

    const isGroupOpen = (groupName: string, hasChannels: boolean) => {
        if (groupName in openGroups) {
            return openGroups[groupName]
        }
        return hasChannels
    }

    const sortableGroupNames = data.groupedChannels
        .map(([groupName]) => groupName)
        .filter((groupName) => groupName !== "Favorites")

    // A single group has nowhere to go — showing a grab cursor on it would
    // advertise a drag that can't do anything.
    const canReorder = sortableGroupNames.length > 1

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            reorder(String(active.id), String(over.id))
        }
    }

    return (
        <div className="flex h-full flex-col bg-surface-sidebar">
            <div ref={setScrollerRef} className="min-h-0 flex-1 overflow-auto p-2 pb-12">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sortableGroupNames} strategy={verticalListSortingStrategy}>
                        <ul className="flex flex-col gap-0.5">
                            {data.groupedChannels.map(([groupName, channels]) => (
                                <SortableGroup
                                    key={groupName}
                                    groupName={groupName}
                                    globalSort={globalSort}
                                    canReorder={canReorder}
                                    open={isGroupOpen(groupName, channels.length > 0)}
                                    onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [groupName]: open }))}
                                >
                                    <ul className="ml-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-outline-gray-1 px-2 py-0.5">
                                        {channels.map((channel) => (
                                            <li key={channel.name}>
                                                <PreviewRow channel={channel} />
                                            </li>
                                        ))}
                                    </ul>
                                </SortableGroup>
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>

                {scrollerRef && <Virtuoso
                    customScrollParent={scrollerRef}
                    data={data.ungroupedChannels}
                    computeItemKey={(_index, channel) => channel.name}
                    itemContent={(_index, channel) => <PreviewRow channel={channel} />}
                />}
            </div>
        </div>
    )
}

/**
 * The sortable unit is this whole <li> — header AND the group's channels — not just
 * the header. dnd-kit measures the node it is given, so a header-only sortable made
 * every group look one header tall: dropping "below" an OPEN group landed the dragged
 * group between that group's header and its own channels. Measuring the full block
 * keeps channels stuck to their group.
 *
 * The activator is the whole HEADER (not the whole li) — channels rows stay
 * plain content, and the sensor's distance constraint keeps header clicks
 * working as the collapse toggle.
 */
const SortableGroup = ({
    groupName,
    globalSort,
    canReorder,
    open,
    onOpenChange,
    children,
}: {
    groupName: string
    globalSort?: string
    canReorder: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}) => {
    const isSortable = groupName !== "Favorites"
    const draggable = isSortable && canReorder
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: groupName,
        disabled: !draggable,
    })

    return (
        <li
            ref={setNodeRef}
            // Translate, NOT Transform: dnd-kit's transform also carries scaleX/scaleY to
            // morph the dragged item toward the target's size. That was invisible while
            // every sortable was a uniform-height header, but these items are whole groups
            // of very different heights, so the scale visibly stretches them.
            style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
        >
            {/* Collapsible lives INSIDE the li rather than wrapping it with asChild:
                Slot would hand `group/collapsible` and `data-state` to SortableGroup, which
                is not a DOM node and cannot forward them, breaking the chevron's
                group-data-[state=open]/collapsible rotation. */}
            <Collapsible open={open} onOpenChange={onOpenChange} className="group/collapsible">
                <PreviewGroupHeader
                    groupName={groupName}
                    isSortable={isSortable}
                    globalSort={globalSort}
                    // Undefined when the group can't move (Favorites, or it's the only
                    // group): spreading a disabled sortable's attributes would still stamp
                    // role="button" + tabIndex on it, and the header keys its grab cursor
                    // off the presence of these props.
                    dragRef={draggable ? setActivatorNodeRef : undefined}
                    dragProps={draggable ? { ...attributes, ...listeners } : undefined}
                />
                <CollapsibleContent>{children}</CollapsibleContent>
            </Collapsible>
        </li>
    )
}

const PreviewRow = ({ channel }: { channel: ChannelSidebarData['ungroupedChannels'][number] }) => (
    <div className="flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-ink-gray-7">
        <ChannelIcon type={channel.type || "Public"} className="h-4 w-4 shrink-0" />
        {/* leading-snug to match ChannelSidebar's ChannelItem — the preview has to
            clip descenders exactly the way the real sidebar does, or it isn't one. */}
        <span className="truncate leading-snug">{channel.channel_name}</span>
    </div>
)
