import { useContext, useEffect, useMemo, useReducer, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import { prefetchChannel, type FrappeCallClient } from "@stores/messages/loaders"
import { atom, useAtomValue, useSetAtom } from "jotai"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@components/ui/drawer"
import { Badge } from "@components/ui/badge"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { useChannels } from "@stores/channels/useChannelList"
import { channelUnreadStore } from "@stores/unread/store"
import { useMyWorkspaces, useSaveWorkspaceOrder, useWorkspaces, type WorkspaceFields } from "@hooks/useWorkspaces"
import { isJoinable } from "@hooks/useWorkspaceMembership"
import { JoinWorkspaceSheet } from "@components/features/workspaces/JoinWorkspaceSheet"
import { LeaveWorkspaceDialog } from "@components/features/workspaces/LeaveWorkspaceDialog"
import { WorkspaceTile } from "./WorkspaceTile"
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable"
import { Button } from "@components/ui/button"
import { Plus } from "lucide-react"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import { useNavigateFromDrawer } from "@hooks/useNavigateFromDrawer"
import { useNoDragWhileScrolled } from "@hooks/useNoDragWhileScrolled"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * The mobile "catch up" drawer — opened by LONG-PRESSING Home in the footer
 * (v3's replacement for v2's always-visible workspace rail, which paid a
 * permanent strip of screen for an occasional job).
 *
 * TWO ZONES with deliberately different anatomy, so the two jobs never compete
 * (nested workspace-rows + channel-rows always read as mush):
 *
 *  - A GRID of workspace logos on top, four to a row — v2's rail summoned on
 *    demand. Tap switches workspace; a long-press starts EDIT MODE (tiles
 *    jiggle iOS-style: drag reorders them, a badge leaves one); a dot marks
 *    workspaces with unreads; the current one is ringed. A last tile lists the
 *    workspaces you can join. Works when everything is read.
 *  - A LIST of unread channels beneath, full-width rows in the sidebar idiom,
 *    grouped under plain-text workspace names (headers are labels, not rows —
 *    nothing competes with the channel rows for tap weight).
 *
 * Muted channels are excluded, matching every other unread aggregate (the Home
 * dot that advertises this drawer among them).
 */
/**
 * Shared open state: the footer's Home long-press AND the channel sidebar's
 * workspace switcher (mobile) both open the same drawer instance, which lives
 * in AppMobileFooter — mounted on every mobile page either trigger exists on.
 */
export const workspacesDrawerAtom = atom(false)

export const HomeWorkspacesDrawer = ({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {

    // CHANNEL opens pay the drawer-exit wait: navigation waits for the drawer
    // to FINISH closing, or the drawer gets baked into the OS back-swipe
    // screenshot and haunts the next back gesture (see useNavigateFromDrawer).
    //
    // A WORKSPACE switch does NOT use that hook (see openWorkspace) — it lands
    // on the same list page under the closing drawer, and routing through the
    // close-then-navigate hook lost a race with useHistoryBackClose's back()
    // (workspace switching broke). It navigates directly, then closes.
    const handleNavigate = useNavigateFromDrawer(() => onOpenChange(false))

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader className="px-4 pb-0 pt-0">
                    <DrawerTitle className="sr-only">{_("Workspaces")}</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        {_("Unread channels across all your workspaces")}
                    </DrawerDescription>
                </DrawerHeader>
                {/* Content only mounts while open (vaul unmounts closed drawers),
                    so the store subscription below never runs in the background. */}
                <DrawerBody onNavigate={handleNavigate} onClose={() => onOpenChange(false)} />
            </DrawerContent>
        </Drawer>
    )
}

type UnreadRow = { channel: ChannelListItem; workspace: WorkspaceFields; count: number }

const DrawerBody = ({ onNavigate, onClose }: {
    onNavigate: (to: string) => void
    onClose: () => void
}) => {
    const navigate = useNavigate()
    const noDragProps = useNoDragWhileScrolled()
    const { workspaces } = useWorkspaces()
    const { channels } = useChannels()
    const currentWorkspace = useAtomValue(lastWorkspaceAtom)

    // Re-derive rows when any unread count changes while the drawer is open
    // (a version bump keeps the useMemo below as the single compute site — a
    // useSyncExternalStore snapshot would need a stable array identity).
    const [unreadVersion, bumpUnreadVersion] = useReducer((version: number) => version + 1, 0)
    useEffect(() => channelUnreadStore.subscribeGlobal(bumpUnreadVersion), [])

    // Workspaces in the user's pinned order, same as the rail and the switcher.
    const myWorkspaces = useMyWorkspaces()

    // One flat list: workspace pinned order, then alphabetical within it.
    const unreadRows = useMemo<UnreadRow[]>(() => {
        return myWorkspaces.flatMap((workspace) =>
            channels
                .filter((channel) => channel.workspace === workspace.name && !channel.muted && !channel.is_archived)
                .map((channel) => ({ channel, workspace, count: channelUnreadStore.getState(channel.name).count }))
                .filter((row) => row.count > 0)
                .sort((a, b) => a.channel.channel_name.localeCompare(b.channel.channel_name)),
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps -- unreadVersion IS the store dependency
    }, [myWorkspaces, channels, unreadVersion])

    const unreadWorkspaceIDs = useMemo(
        () => new Set(unreadRows.map((row) => row.workspace.name)),
        [unreadRows],
    )

    const setLastWorkspace = useSetAtom(lastWorkspaceAtom)
    const setLastChannel = useSetAtom(lastChannelAtom)
    const { call } = useContext(FrappeContext) as FrappeConfig

    // Both handlers hand the destination to the parent (onNavigate) instead of
    // navigating here — the parent dismisses the drawer first, then navigates.

    const openWorkspace = (workspace: WorkspaceFields) => {
        // Persist immediately — on mobile no channel opens after a switch (the
        // list IS the page), so the Channel page's pair-write never fires.
        setLastWorkspace(workspace.name)
        setLastChannel("")
        // Navigate FIRST, then close — order matters. navigate() pushes the
        // workspace entry synchronously, so useHistoryBackClose's cleanup sees
        // its overlay entry is no longer on top and skips its back(). Closing
        // first (as useNavigateFromDrawer does) let that async back() fire
        // AFTER the instant navigate and pop the workspace right back off —
        // that was the broken switch. The switch just swaps the list under the
        // closing drawer, so no exit-wait is needed here.
        navigate(`/${encodeURIComponent(workspace.name)}`)
        onClose()
    }

    const openChannel = (row: UnreadRow) => {
        // Start fetching the channel's messages NOW — navigation waits out the
        // drawer's 500ms close (see the parent), and this fetch runs during it,
        // so the channel usually opens already loaded. No-op if already warm.
        prefetchChannel(call as FrappeCallClient, row.channel.name)
        // The Channel page records last-visited itself; just go.
        onNavigate(`/${encodeURIComponent(row.workspace.name)}/${encodeURIComponent(row.channel.name)}`)
    }

    // Rows are already in workspace order — fold them into per-workspace
    // sections for the plain-text group headers. Headers only earn their place
    // when there's more than one workspace to tell apart.
    const sections = useMemo(() => {
        const out: { workspace: WorkspaceFields; rows: UnreadRow[] }[] = []
        for (const row of unreadRows) {
            const last = out[out.length - 1]
            if (last && last.workspace.name === row.workspace.name) last.rows.push(row)
            else out.push({ workspace: row.workspace, rows: [row] })
        }
        return out
    }, [unreadRows])
    const showSectionHeaders = myWorkspaces.length > 1

    // Public workspaces open to anyone: the grid ends with a tile that lists them.
    const joinable = useMemo(() => workspaces.filter(isJoinable), [workspaces])
    const [joinOpen, setJoinOpen] = useState(false)

    // Long-pressing any tile puts the grid in edit mode (jiggle, drag to
    // reorder, badge to leave); Done — or closing the drawer — ends it.
    const [editing, setEditing] = useState(false)
    const [leaving, setLeaving] = useState<WorkspaceFields | null>(null)

    const saveWorkspaceOrder = useSaveWorkspaceOrder()
    // Distance constraint keeps badge taps as taps — a drag starts after 4px.
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = myWorkspaces.findIndex((workspace) => workspace.name === active.id)
        const newIndex = myWorkspaces.findIndex((workspace) => workspace.name === over.id)
        if (oldIndex < 0 || newIndex < 0) return
        saveWorkspaceOrder(arrayMove(myWorkspaces, oldIndex, newIndex))
    }
    const location = useLocation()
    const afterLeave = (left: WorkspaceFields) => {
        const next = myWorkspaces.find((workspace) => workspace.name !== left.name)
        // Home must not reopen a workspace that was left, nor a channel of it under the next one.
        if (left.name === currentWorkspace) {
            setLastWorkspace(next?.name ?? "")
            setLastChannel("")
        }
        // Only a screen inside the left workspace moves: to the next one, or home when none is left.
        const base = `/${encodeURIComponent(left.name)}`
        if (location.pathname !== base && !location.pathname.startsWith(`${base}/`)) return
        if (next) return openWorkspace(next)
        navigate("/")
        onClose()
    }

    return (
        <div className="flex min-h-0 flex-col pb-2">
            {/* Edit mode's exit — iOS's Done, in the corner iOS puts it. The row
                stays mounted and animates its height so the sheet GROWS into edit
                mode instead of jumping a row taller; inert keeps the hidden
                button out of the tab order. */}
            <div
                inert={!editing}
                className={cn(
                    "overflow-hidden transition-all duration-200",
                    editing ? "max-h-12 opacity-100" : "max-h-0 opacity-0",
                )}
            >
                <div className="flex items-center justify-between pb-1 pl-4 pr-3">
                    <span className="text-p-sm text-ink-gray-5">{_("Drag to reorder")}</span>
                    <Button variant="subtle" size="sm" onClick={() => setEditing(false)}>
                        {_("Done")}
                    </Button>
                </div>
            </div>
            {/* Zone 1 — the workspace grid. WRAPS instead of scrolling: every
                workspace stays visible (a hidden one with unreads would defeat
                the triage job) and each keeps a fixed position (spatial memory —
                the whole point of a switcher). Fixed FOUR columns: tiles line up
                in a stable grid and get room for their two-line names. */}
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                <SortableContext items={myWorkspaces.map((workspace) => workspace.name)} strategy={rectSortingStrategy}>
                    {/* While editing, a vertical tile drag must stay a tile drag —
                        without the attribute vaul reads it as sheet-dismiss. */}
                    <div
                        data-vaul-no-drag={editing ? true : undefined}
                        className="grid grid-cols-4 items-start gap-1 px-3 pb-3 pt-1"
                    >
                        {myWorkspaces.map((workspace, index) => (
                            <WorkspaceTile
                                key={workspace.name}
                                workspace={workspace}
                                index={index}
                                isCurrent={workspace.name === currentWorkspace}
                                hasUnread={unreadWorkspaceIDs.has(workspace.name)}
                                editing={editing}
                                onOpen={() => openWorkspace(workspace)}
                                onEdit={() => setEditing(true)}
                                onRemove={() => setLeaving(workspace)}
                            />
                        ))}
                        {/* Hidden while editing: it is not sortable, and a join
                            mid-reorder would reflow the grid under a drag. */}
                        {!editing && joinable.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setJoinOpen(true)}
                                aria-label={_("Join a workspace")}
                                className="group flex w-full flex-col items-center px-1 py-2"
                            >
                                {/* The press tint sits on the square, not the cell: with no label
                                    below, a full-width tint would read wider than the tile. */}
                                <span className="flex size-12 items-center justify-center rounded-lg border border-dashed border-outline-gray-3 text-ink-gray-6 group-active:bg-surface-gray-2">
                                    <Plus className="size-5" />
                                </span>
                            </button>
                        )}
                    </div>
                </SortableContext>
            </DndContext>
            <JoinWorkspaceSheet open={joinOpen} onOpenChange={setJoinOpen} workspaces={joinable} onJoined={openWorkspace} />
            <LeaveWorkspaceDialog workspace={leaving} onClose={() => setLeaving(null)} onLeft={afterLeave} />

            {/* Zone 2 — unread channels, or the caught-up state. */}
            {unreadRows.length > 0 && (
                <div className="border-t border-outline-gray-2 pt-4">
                    {/* Capped so the whole sheet stays near half the screen even
                        with many unread channels — the workspace grid on top
                        should stay within thumb reach, not ride up the screen.
                        dvh, not vh: in a browser tab vh ignores the collapsing
                        URL bar and would overshoot. */}
                    {/* Positional no-drag (see useNoDragWhileScrolled): the channel list
                        scrolls while scrolled; a pull from its top dismisses the sheet. */}
                    <div {...noDragProps} className="max-h-[35dvh] min-h-0 overflow-y-auto px-2 pb-2">
                        {sections.map(({ workspace, rows }) => (
                            <section key={workspace.name} className="mb-2">
                                {showSectionHeaders && (
                                    <p className="px-2 text-xs-medium pb-px text-ink-gray-4">
                                        {workspace.workspace_name}
                                    </p>
                                )}
                                <ul className="pt-0.5">
                                    {rows.map((row) => (
                                        <li key={row.channel.name}>
                                            <button
                                                type="button"
                                                onClick={() => openChannel(row)}
                                                className="flex py-2.5 w-full items-center gap-1 rounded-md px-2 text-left active:bg-surface-gray-2"
                                            >
                                                <ChannelIcon type={row.channel.type} className="size-4.5 shrink-0 text-ink-gray-6" />
                                                <span className="min-w-0 flex-1 truncate text-base-medium text-ink-gray-8">
                                                    {row.channel.channel_name}
                                                </span>
                                                <Badge size="md" variant="subtle" theme="gray" className="tabular-nums">
                                                    {row.count > 99 ? "99+" : row.count}
                                                </Badge>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
