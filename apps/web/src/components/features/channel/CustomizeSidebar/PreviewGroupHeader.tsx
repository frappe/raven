import { useState } from "react"
import { ArrowDownAzIcon, ArrowDownUp, ChevronRight, ClockIcon, MoreVertical, PencilIcon, Trash2Icon } from "lucide-react"
import { Button } from "@components/ui/button"
import { CollapsibleTrigger } from "@components/ui/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { ChannelGroupLabel } from "@components/channel-sidebar/ChannelSidebar"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { useChannelGroups } from "./useChannelGroups"
import { GroupNameDialog } from "./GroupNameDialog"

interface PreviewGroupHeaderProps {
    groupName: string
    /** Favorites is backed by pinned_channels, not a channel_groups row — it has
     *  no handle, no menu and no sort of its own. */
    isSortable: boolean
    globalSort?: string
    /** Drag wiring owned by SortableGroup — the sortable NODE is the whole <li>
     *  (header + its channels) so a group and its channels move as one unit; the
     *  whole header div is the activator (no grip handle — it pushed the header
     *  content out of line with the channel indent guide). */
    dragRef?: (node: HTMLElement | null) => void
    dragProps?: Record<string, unknown>
}

export const PreviewGroupHeader = ({ groupName, isSortable, globalSort, dragRef, dragProps }: PreviewGroupHeaderProps) => {
    const { groups, renameGroup, deleteGroup, setGroupSort } = useChannelGroups()
    const index = groups.findIndex((group) => group.group_name === groupName)
    const group = groups[index]

    const [renameOpen, setRenameOpen] = useState(false)

    // Only these two values exist as radio items. `sort_channels_by` can still hold the
    // legacy "Unreads First" (unimplemented upstream — sortChannels maps it to recency),
    // and an unmatched value would leave the submenu with NO checkmark at all.
    const resolvedSort = group?.sort_by || globalSort || "Recent Activity"
    const effectiveSort = resolvedSort === "Alphabetical Order" ? resolvedSort : "Recent Activity"

    return (
        // The header itself is the drag activator: px-2 keeps its content on the
        // channel indent guide (a grip handle in front pushed it off), and the grab
        // cursor is the drag affordance instead — shown only when dragProps exist,
        // i.e. when there is actually somewhere for the group to go. The triggers
        // repeat it rather than inherit: cursor is an inherited property, but the UA
        // stylesheet declares `button { cursor: default }`, and a matching declaration
        // beats an inherited value — so a bare child <button> would show an arrow in
        // the middle of the grab surface. dragProps carries dnd-kit's role/tabIndex, keeping
        // keyboard reordering.
        <div
            ref={dragRef}
            {...dragProps}
            className={cn(
                "group/header flex h-8 items-center gap-2 rounded-md px-2 hover:bg-surface-gray-2 focus-visible:focus-ring",
                dragProps ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
            )}
        >
            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-gray-7 outline-none",
                        dragProps ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                    )}
                >
                    <ChannelGroupLabel groupName={groupName} />
                </button>
            </CollapsibleTrigger>

            {isSortable && index >= 0 && (
                <>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                isIconButton
                                aria-label={_("Group options")}
                                className="opacity-0 group-hover/header:opacity-100 data-[state=open]:opacity-100 cursor-pointer"
                            >
                                <MoreVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                                <PencilIcon />
                                {_("Rename")}
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <ArrowDownUp />
                                    {_("Sort channels by")}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup
                                        value={effectiveSort}
                                        onValueChange={(value) => {
                                            // Radix fires onValueChange even when the clicked item is
                                            // already checked, so the no-op case must be handled here.
                                            // Clicking whatever is currently IN EFFECT means "don't pin
                                            // this" — it clears to inherited if pinned, and stays
                                            // inherited if it already was. Only a click on the other
                                            // item pins a concrete value.
                                            const current = group?.sort_by ?? ""
                                            const next = value === effectiveSort ? "" : value
                                            if (next === current) return
                                            setGroupSort(index, next as "" | "Alphabetical Order" | "Recent Activity")
                                        }}
                                    >
                                        <DropdownMenuRadioItem value="Recent Activity">
                                            <ClockIcon />
                                            {_("Recent activity")}
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Alphabetical Order">
                                            <ArrowDownAzIcon />
                                            {_("Alphabetical")}
                                        </DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => deleteGroup(index)}>
                                <Trash2Icon />
                                {_("Delete")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <GroupNameDialog
                        open={renameOpen}
                        onOpenChange={setRenameOpen}
                        title={_("Rename group")}
                        submitLabel={_("Rename")}
                        initialName={groupName}
                        onSubmit={(name) => {
                            // Keeping the same name is a no-op, not a rename — committing it
                            // anyway would dirty the form over nothing.
                            if (name.trim() === groupName) return { ok: true }
                            return renameGroup(index, name)
                        }}
                    />
                </>
            )}

            {/* Chevron on the RIGHT, where the real sidebar keeps it. A second
                trigger so clicking it still toggles — tabIndex -1 leaves the label
                trigger as the group's single tab stop. */}
            <CollapsibleTrigger asChild>
                <button type="button" tabIndex={-1} aria-hidden className="shrink-0 text-ink-gray-7 outline-none cursor-pointer">
                    <ChevronRight className="size-4 rtl:rotate-180 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </button>
            </CollapsibleTrigger>
        </div>
    )
}
