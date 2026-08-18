import { CommandGroup, CommandItem } from '@components/ui/command'
import { Badge } from '@components/ui/badge'
import { WorkspaceLogo } from '@components/channel-sidebar/ChannelSidebar'
import { useWorkspaces } from '@hooks/useWorkspaces'
import useCurrentRavenUser from '@raven/lib/hooks/useCurrentRavenUser'
import { lastChannelAtom, lastWorkspaceAtom } from '@utils/lastVisitedAtoms'
import { commandMenuOpenAtom } from './atoms'
import { useSetAtom } from 'jotai'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { BookmarkIcon, MessageSquareTextIcon, UsersRoundIcon } from 'lucide-react'
import _ from '@lib/translate'

/** The primary rail's fixed destinations. Same icons as the rail, so the
 *  palette rows and the rail read as the same places. */
const GOTO_ITEMS = [
    { value: 'goto-dm-channel', to: '/dm-channel', label: 'Direct Messages', icon: UsersRoundIcon, keywords: ['dm', 'dms', 'direct messages', 'people'] },
    { value: 'goto-threads', to: '/threads', label: 'Threads', icon: MessageSquareTextIcon, keywords: ['threads', 'replies'] },
    { value: 'goto-saved-messages', to: '/saved-messages', label: 'Saved Messages', icon: BookmarkIcon, keywords: ['saved', 'saved messages', 'bookmarks'] },
] as const

/**
 * Workspace switching + rail destinations for the command palette.
 *
 * No manual text filtering here (unlike ChannelList, which pre-filters to cap
 * thousands of candidates): both lists are small, and the palette's
 * keywords-only filter already scores them — an item's `value` stays a stable
 * unique id and all the searchable text lives in `keywords`.
 */
const NavigationList = ({ text }: { text: string }) => {
    const navigate = useNavigate()
    const setOpen = useSetAtom(commandMenuOpenAtom)

    // NOT useParams: the palette mounts at the AppShell root, and useParams only
    // sees params up to its own route depth — at the root that is always {}.
    // The first path segment IS the workspace on workspace routes; comparing it
    // against the member list below filters out static pages like /threads.
    const location = useLocation()
    const firstSegment = decodeURIComponent(location.pathname.split('/')[1] ?? '')

    const { workspaces } = useWorkspaces()
    const { myProfile } = useCurrentRavenUser()
    const setLastWorkspace = useSetAtom(lastWorkspaceAtom)
    const setLastChannel = useSetAtom(lastChannelAtom)

    // Member workspaces in the user's pinned order — the same rule as the
    // primary rail and the mobile switcher drawer, so all three agree.
    const myWorkspaces = useMemo(() => {
        const members = workspaces.filter((workspace) => workspace.workspace_member_name)
        const position = new Map((myProfile?.pinned_workspaces ?? []).map((row, index) => [row.workspace, index]))
        if (position.size === 0) return members
        return [...members].sort((a, b) => (position.get(a.name) ?? Infinity) - (position.get(b.name) ?? Infinity))
    }, [workspaces, myProfile?.pinned_workspaces])

    const openWorkspace = (name: string) => {
        // Same semantics as the mobile switcher drawer: persist the switch
        // immediately — landing on the workspace page opens no channel, so the
        // Channel page's last-visited pair-write never fires.
        setLastWorkspace(name)
        setLastChannel('')
        navigate(`/${encodeURIComponent(name)}`)
        setOpen(false)
    }

    const workspaceRows = myWorkspaces.length > 1 ? myWorkspaces.map((workspace) => (
        <CommandItem
            key={workspace.name}
            value={`workspace-${workspace.name}`}
            keywords={[workspace.workspace_name, 'workspace']}
            onSelect={() => openWorkspace(workspace.name)}
            className='cursor-pointer'
        >
            <WorkspaceLogo workspace={workspace} className="size-4 rounded" />
            <span className="truncate">{workspace.workspace_name}</span>
            {workspace.name === firstSegment && (
                <Badge variant="subtle" size="sm" className="ml-auto">
                    {_("Current")}
                </Badge>
            )}
        </CommandItem>
    )) : null

    const gotoRows = GOTO_ITEMS.map((item) => (
        <CommandItem
            key={item.value}
            value={item.value}
            keywords={[...item.keywords]}
            onSelect={() => {
                navigate(item.to)
                setOpen(false)
            }}
            className='cursor-pointer'
        >
            <item.icon className="h-4 w-4" />
            <span>{_(item.label)}</span>
        </CommandItem>
    ))

    // While searching, rows go bare into the palette's single ranking group
    // (see CommandPalette). Browsing keeps the labeled sections.
    if (text) return <>{workspaceRows}{gotoRows}</>

    return (
        <>
            {workspaceRows && <CommandGroup heading={_("Workspaces")}>{workspaceRows}</CommandGroup>}
            <CommandGroup heading={_("Go to")}>{gotoRows}</CommandGroup>
        </>
    )
}

export default NavigationList
