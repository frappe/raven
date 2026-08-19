import { useEffect, useMemo, useRef, useState } from "react"
import { useSetAtom } from "jotai"
import { NavLink, useMatch, useNavigate, useParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Check, ChevronDown, ChevronRight, Hash, PencilLine, Star } from "lucide-react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { useLocalStorage } from "usehooks-ts"
import { useChannelUnread, useGroupUnreadCount, useWorkspaceUnread } from "@stores/unread/useChannelUnread"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Skeleton } from "@components/ui/skeleton"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@components/ui/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { CustomizeSidebarButton } from "@components/features/channel/CustomizeSidebar/CustomizeSidebarButton"
import { MobileSearchButton } from "@components/features/header/QuickSearch/SearchButton"
import { useWorkspaces, type WorkspaceFields } from "@hooks/useWorkspaces"
import { workspacesDrawerAtom } from "@components/features/header/HomeWorkspacesDrawer"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import { useChannels } from "@stores/channels/useChannelList"
import { usePrefetchChannel, setChannelListScrolling } from "@stores/messages/usePrefetchChannel"
import { useGroupedChannels } from "@raven/lib/hooks/useGroupedChannels"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { useChannelDraft } from "@components/features/ChatInput/draft"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { useIsMobile } from "@hooks/use-mobile"

interface GroupsState {
    [key: string]: boolean
}

/**
 * Workspace channel list, built from plain layout primitives — the slot in
 * WorkspaceLayout owns the width ("drawers fill, slots size"), this fills it.
 * Rows are NavLinks, so browser affordances (cmd+click, middle-click, copy
 * link address) work and active state comes from the route, not props.
 *
 * The sidebar is a full-height column with its OWN header (workspace
 * switcher + overflow menu) — the content column's AppHeader starts after
 * it, so the heading visually belongs to the sidebar surface.
 */
export function ChannelSidebar() {
    const { channels, isLoading } = useChannels()
    const { myProfile } = useCurrentRavenUser()
    const { workspaceID } = useParams()
    const { groupedChannels, ungroupedChannels } = useGroupedChannels(
        channels,
        myProfile,
        workspaceID,
    )

    const [groupsState, setGroupsState] = useLocalStorage<GroupsState>("channel-sidebar-groups-state", {})
    const [scrollerRef, setScrollerRef] = useState<HTMLElement | null>(null)

    const navigate = useNavigate()
    const virtuosoRef = useRef<VirtuosoHandle>(null)
    // Reset the scroll-suppression flag if we unmount mid-scroll (Virtuoso's isScrolling(false)
    // wouldn't fire), so prefetch isn't left globally suppressed.
    useEffect(() => () => setChannelListScrolling(false), [])
    // Active channel from the URL (the sidebar mounts above the :id route,
    // so useParams can't see it; end: false tolerates an open thread)
    const currentChannelID = useMatch({ path: "/:workspaceID/:id", end: false })?.params.id

    /**
     * Keyboard navigation walks DISPLAY order: grouped channels first (in
     * group order), then ungrouped. Collapsed groups are included — landing
     * on a hidden channel is fine because a collapsed group always shows its
     * active member (see ChannelGroup).
     */
    const flatChannels = useMemo(
        () => [...groupedChannels.flatMap(([, groupChannels]) => groupChannels), ...ungroupedChannels],
        [groupedChannels, ungroupedChannels],
    )

    /** Cmd/Ctrl+Down = next channel, Cmd/Ctrl+Up = previous — clamped at the ends. */
    const goToAdjacentChannel = (direction: 1 | -1) => {
        if (flatChannels.length === 0) return
        const currentIndex = flatChannels.findIndex((channel) => channel.name === currentChannelID)
        const nextIndex =
            currentIndex === -1
                ? direction === 1
                    ? 0
                    : flatChannels.length - 1
                : Math.min(flatChannels.length - 1, Math.max(0, currentIndex + direction))
        if (nextIndex === currentIndex) return
        const target = flatChannels[nextIndex]
        navigate(`/${encodeURIComponent(workspaceID ?? "")}/${encodeURIComponent(target.name)}`)
        // Only the ungrouped list is virtualized — keep its active row in view
        const ungroupedIndex = ungroupedChannels.indexOf(target)
        if (ungroupedIndex !== -1) virtuosoRef.current?.scrollIntoView({ index: ungroupedIndex })
    }

    const hotkeyOptions = { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true }
    useHotkeys("mod+down", () => goToAdjacentChannel(1), hotkeyOptions, [flatChannels, currentChannelID])
    useHotkeys("mod+up", () => goToAdjacentChannel(-1), hotkeyOptions, [flatChannels, currentChannelID])

    const loading = isLoading || !myProfile
    const isEmpty = groupedChannels.length === 0 && ungroupedChannels.length === 0

    return (
        // Mobile: the sidebar is a full page, so it sits on the page surface;
        // the panel tint only makes sense beside content (desktop)
        <nav className="flex h-full w-full flex-col bg-surface-base md:bg-surface-sidebar">
            {/* Border on mobile (full-page list needs the separator); none on
                desktop (the content island carries its own bordered header) */}
            <div className="flex h-11 md:h-auto shrink-0 items-center justify-between gap-1 border-b md:border-b-transparent px-1 md:py-2">
                <WorkspaceSwitcher workspaceID={workspaceID} />
                <div className="flex items-center gap-2">
                    <CustomizeSidebarButton />
                    <span className="md:hidden">
                        <MobileSearchButton />
                    </span>
                </div>
            </div>

            {loading ? (
                <ChannelSidebarSkeleton />
            ) : isEmpty ? (
                <EmptyChannels />
            ) : (
                // Mobile: the in-flow AppMobileFooter below reserves the tab-bar + home-
                // indicator space, so the list only needs a small breathing pad of its own.
                <div ref={setScrollerRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-2 md:py-0 pb-2 md:pb-0 space-y-1">
                    <ul className="flex flex-col gap-1">
                        {groupedChannels.map(([groupName, groupChannels]) => (
                            <ChannelGroup
                                key={groupName}
                                groupName={groupName}
                                channels={groupChannels}
                                workspaceID={workspaceID}
                                currentChannelID={currentChannelID}
                                open={groupsState[groupName] ?? true}
                                onOpenChange={(open) => setGroupsState((prev) => ({ ...prev, [groupName]: open }))}
                            />
                        ))}
                    </ul>

                    {/* Ungrouped channels — virtualized against the shared scroller.
                        Spacing via per-item padding: Virtuoso rows can't use flex gap */}
                    {scrollerRef && (
                        <Virtuoso
                            ref={virtuosoRef}
                            customScrollParent={scrollerRef}
                            data={ungroupedChannels}
                            isScrolling={setChannelListScrolling}
                            computeItemKey={(_index, channel) => channel.name}
                            itemContent={(_index, channel) => (
                                <div className="pb-1">
                                    <ChannelRow channel={channel} workspaceID={workspaceID} />
                                </div>
                            )}
                        />
                    )}
                </div>
            )}
        </nav>
    )
}

const ChannelSidebarSkeleton = () => (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 py-2">
        {Array.from({ length: 18 }).map((_, index) => (
            <div key={index} className="flex h-7 items-center gap-2 px-2">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 rounded-sm" style={{ width: `${45 + ((index * 17) % 40)}%` }} />
            </div>
        ))}
    </div>
)

const EmptyChannels = () => {

    return (
        <Empty>
            <EmptyMedia>
                <Hash />
            </EmptyMedia>
            <EmptyHeader>
                <EmptyTitle>{_("No channels yet")}</EmptyTitle>
                <EmptyDescription>{_("Create one from the menu above.")}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}

/**
 * Workspace name as a dropdown — doubles as the workspace SWITCHER, which is
 * the only way to change workspaces on mobile (the primary rail is
 * desktop-only; on desktop it's a convenient redundancy).
 */
const WorkspaceSwitcher = ({ workspaceID }: { workspaceID?: string }) => {
    const { workspaces } = useWorkspaces()
    const { myProfile } = useCurrentRavenUser()

    // Per-user order from the Raven User's pinned_workspaces child table: rows
    // come first (in row order), workspaces NOT in the table follow in their
    // server order — so joining a new workspace never needs a migration, it
    // just appends until the next drag writes the full order.
    const myWorkspaces = useMemo(() => {
        const members = workspaces.filter((workspace) => workspace.workspace_member_name)
        const position = new Map((myProfile?.pinned_workspaces ?? []).map((row, index) => [row.workspace, index]))
        if (position.size === 0) return members
        return [...members].sort(
            (a, b) => (position.get(a.name) ?? Infinity) - (position.get(b.name) ?? Infinity),
        )
    }, [workspaces, myProfile?.pinned_workspaces])

    const navigate = useNavigate()
    const setLastWorkspace = useSetAtom(lastWorkspaceAtom)
    const setLastChannel = useSetAtom(lastChannelAtom)
    const current = workspaces.find((workspace) => workspace.name === workspaceID)
    const isMobile = useIsMobile()

    const switchWorkspace = (workspace: WorkspaceFields) => {
        // Persist the choice immediately: on mobile no channel opens after a
        // switch (the list IS the page), so the Channel page's pair-write
        // never fires. The stale channel is cleared to keep the pair honest.
        setLastWorkspace(workspace.name)
        setLastChannel("")
        navigate(`/${encodeURIComponent(workspace.name)}`)
    }

    const openWorkspacesDrawer = useSetAtom(workspacesDrawerAtom)

    // Mobile: the same trigger opens the workspaces DRAWER (strip + unreads —
    // hosted by AppMobileFooter, also reachable by long-pressing Home) instead
    // of a cramped dropdown. Desktop keeps the dropdown.
    if (isMobile) {
        return (
            <Button variant="ghost" size="lg" className="rounded" onClick={() => openWorkspacesDrawer(true)}>
                {current && <WorkspaceLogo workspace={current} className="size-5" />}
                <span className="truncate text-ink-gray-8 text-lg-medium">{current?.workspace_name || workspaceID}</span>
                <ChevronDown className="size-4" />
            </Button>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="md" className="rounded">
                    {current && <WorkspaceLogo workspace={current} className="size-5" />}
                    <span className="truncate text-ink-gray-8 text-lg-medium md:text-sm">{current?.workspace_name || workspaceID}</span>
                    <ChevronDown className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4} className="min-w-64">
                {myWorkspaces.map((workspace) => (
                    <WorkspaceSwitcherItem
                        key={workspace.name}
                        workspace={workspace}
                        isCurrent={workspace.name === workspaceID}
                        onSelect={() => switchWorkspace(workspace)}
                    />
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const WorkspaceSwitcherItem = ({
    workspace,
    isCurrent,
    onSelect,
}: {
    workspace: WorkspaceFields
    isCurrent: boolean
    onSelect: () => void
}) => {
    const unread = useWorkspaceUnread(workspace.name)

    return (
        <DropdownMenuItem onClick={onSelect} className="py-2">
            <WorkspaceLogo workspace={workspace} />
            <span className="truncate text-lg md:text-sm leading-snug">{workspace.workspace_name}</span>
            {/* The current workspace shows the check; the others surface their unread */}
            {isCurrent ? (
                <Check className="ml-auto h-4 w-4 text-ink-gray-8" />
            ) : (
                unread > 0 && (
                    <Badge size="sm" variant="ghost" theme="gray" className="ml-auto shrink-0">
                        {unread > 9 ? "9+" : unread}
                    </Badge>
                )
            )}
        </DropdownMenuItem >
    )
}

/** Small square logo, first-letter fallback — same resolution as the primary rail.
 *  Exported for the mobile catch-up drawer (long-press Home). */
export const WorkspaceLogo = ({ workspace, className }: { workspace: WorkspaceFields, className?: string }) => (
    <Avatar className={cn("size-4.5 shrink-0 rounded-sm", className)}>
        <AvatarImage src={workspace.logo} alt={workspace.workspace_name} />
        <AvatarFallback className="rounded-none bg-surface-gray-3 text-2xs text-ink-gray-5">
            {workspace.workspace_name.charAt(0)}
        </AvatarFallback>
    </Avatar>
)

const ChannelGroup = ({
    groupName,
    channels,
    workspaceID,
    currentChannelID,
    open,
    onOpenChange,
}: {
    groupName: string
    channels: ChannelListItem[]
    workspaceID?: string
    currentChannelID?: string
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    // Group badge sums the unread MESSAGE counts of its channels — it mirrors the
    // per-channel badges it hides while collapsed, so one noisy channel inflates it.
    const totalUnread = useGroupUnreadCount(useMemo(() => channels.filter((c) => !c.muted).map((c) => c.name), [channels]))

    // Slack-style: collapsing a group never hides where you ARE — the active
    // member stays visible as a single row under the collapsed header
    const pinnedActiveChannel = !open
        ? channels.find((channel) => channel.name === currentChannelID)
        : undefined

    return (
        <Collapsible asChild open={open} onOpenChange={onOpenChange} className="group/collapsible">
            <li>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex py-2 w-full justify-between cursor-pointer select-none items-center gap-2 rounded md:px-2 px-3 text-ink-gray-7 outline-none ring-outline-gray-3 transition-colors hover:bg-surface-gray-3 hover:text-ink-gray-8 focus-visible:ring-2"
                    >
                        <div className="flex items-center gap-1">
                            <ChannelGroupLabel groupName={groupName} isHighlighted={!open && totalUnread > 0} />
                            {totalUnread > 0 && (
                                <Badge
                                    size="sm"
                                    variant="ghost"
                                    theme="gray"
                                    className="shrink-0 opacity-0 transition-opacity group-data-[state=closed]/collapsible:opacity-100"
                                >
                                    {totalUnread > 9 ? "9+" : totalUnread}
                                </Badge>
                            )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <ul className="md:ml-3.5 ml-4.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-outline-gray-1 dark:border-outline-gray-2 pl-2 py-0.5">
                        {channels.map((channel) => (
                            <li key={channel.name}>
                                <ChannelRow channel={channel} workspaceID={workspaceID} />
                            </li>
                        ))}
                    </ul>
                </CollapsibleContent>
                {pinnedActiveChannel && (
                    <ul className="ml-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-outline-gray-1 px-2 py-0.5">
                        <li>
                            <ChannelRow channel={pinnedActiveChannel} workspaceID={workspaceID} />
                        </li>
                    </ul>
                )}
            </li>
        </Collapsible>
    )
}

/** Group heading: "Favorites" gets a star, custom groups show their leading emoji. */
export const ChannelGroupLabel = ({ groupName, isHighlighted = false }: { groupName: string, isHighlighted?: boolean }) => {
    if (groupName === "Favorites") {
        return (
            <span className="flex min-w-0 items-center gap-2">
                <Star className="h-4 w-4 shrink-0 text-ink-gray-6" />
                <span className={cn("truncate leading-snug text-lg md:text-sm", isHighlighted ? "text-ink-gray-10 dark:text-ink-gray-10 font-medium" : "text-ink-gray-6 dark:text-ink-gray-7")}>{_("Favorites")}</span>
            </span>
        )
    }

    // Match emoji including compound emojis (with ZWJ)
    const emojiMatch = groupName.match(/^[\p{Emoji}\u200d]+/u)
    const emoji = emojiMatch ? emojiMatch[0] : null
    const nameWithoutEmoji = groupName.replace(/^[\p{Emoji}\u200d]+\s?/u, "")

    return (
        <span className="flex min-w-0 items-center gap-1.5">
            {emoji && <span className="shrink-0 text-lg leading-none">{emoji}</span>}
            {/* leading-snug: avoid Safari clipping descenders on the truncated label (1.15 is too tight) */}
            <span className={cn("truncate leading-snug text-lg md:text-sm", isHighlighted ? "text-ink-gray-10 font-medium" : "text-ink-gray-7")}>{nameWithoutEmoji}</span>
        </span>
    )
}

const ChannelRow = ({ channel, workspaceID }: { channel: ChannelListItem; workspaceID?: string }) => {
    const { count: unread } = useChannelUnread(channel.name)
    const prefetchHandlers = usePrefetchChannel(channel.name, unread > 0)
    // Channel rows have no preview line — an unsent draft shows as a pencil.
    const draft = useChannelDraft(channel.name)

    return (
        <NavLink
            {...prefetchHandlers}
            to={`/${encodeURIComponent(workspaceID ?? "")}/${encodeURIComponent(channel.name)}`}
            className={({ isActive }) =>
                cn(
                    "flex min-w-0 select-none items-center gap-1.5 overflow-hidden rounded text-base px-3 md:px-2 text-ink-gray-6 dark:text-ink-gray-7 py-2 md:py-1.5",
                    // `transition` (not transition-colors) so box-shadow animates IN SYNC
                    // with the background — Virtuoso recycles rows on workspace switch, and
                    // transition-colors left the shadow popping while the bg cross-faded.
                    "outline-none ring-outline-gray-2 transition focus-visible:ring-2",
                    "hover:bg-surface-gray-3 active:bg-surface-gray-3",
                    unread > 0 && !channel.muted && "text-ink-gray-7 dark:text-ink-gray-8",
                    isActive && "bg-surface-elevation-3 shadow-sm text-ink-gray-8 dark:text-ink-gray-9 hover:bg-surface-elevation-3 active:bg-surface-elevation-3",
                )
            }
        >
            <ChannelIcon type={channel.type || "Public"} className="h-4 w-4 shrink-0" />
            <span
                className={cn(
                    // leading-snug: the type scale's 1.15 line-height is too tight to contain
                    // descenders (g/y/p) once `truncate` clips overflow — Safari cuts them on
                    // some DPIs. A looser single-line height fixes it.
                    "min-w-0 flex-1 truncate text-lg md:text-sm leading-snug",
                    unread > 0 && !channel.muted ? "font-semibold" : "font-normal",
                )}
            >
                {channel.channel_name}
            </span>
            {draft && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PencilLine className="h-3.5 w-3.5 shrink-0 text-ink-gray-5" />
                    </TooltipTrigger>
                    {/* The draft text itself — channel rows have no preview line to show it */}
                    <TooltipContent side="right" className="max-w-64">
                        <span className="line-clamp-3 break-words">{_("Draft")}: {draft}</span>
                    </TooltipContent>
                </Tooltip>
            )}
            {unread > 0 && !channel.muted && (
                <Badge size="sm" variant="ghost" theme="gray" className="shrink-0 px-0 justify-center tabular-nums">
                    {unread > 9 ? "9+" : unread}
                </Badge>
            )}
        </NavLink>
    )
}
