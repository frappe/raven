import { useMemo, useState, useRef } from 'react'
import { useFrappeGetCall } from 'frappe-react-sdk'
import { Button } from '@components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@components/ui/empty'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@components/ui/hover-card'
import { Input } from '@components/ui/input'
import { ScrollArea } from '@components/ui/scroll-area'
import { Skeleton } from '@components/ui/skeleton'
import { InputGroup, InputGroupAddon } from '@components/ui/input-group'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { CheckIcon, Search, SearchX, UsersRound } from 'lucide-react'
import { db, UserData } from "@db"
import { useLiveQuery } from 'dexie-react-hooks';
import { useDebounceValue } from 'usehooks-ts';
import _ from '@lib/translate'
import { cn } from '@lib/utils'
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { Virtuoso } from 'react-virtuoso'

interface AddMembersStepProps {
    selectedUsers: UserData[]
    onSelectUsers: (users: UserData[]) => void
    /** The workspace the channel lives in — only ITS members can be added.
     *  Omit to pick from ALL enabled users (workspace-member management). */
    workspace?: string
    /** Users to hide from the list entirely — e.g. the channel's EXISTING members
     *  when adding to an already-created channel. */
    excludeUserIds?: string[]
    /** Description for the "no one to add" empty state (nobody left after the
     *  exclusions, before any search). Defaults to the create-channel wording. */
    emptyText?: string
}

/**
 * Member selection as ONE toggle list (checkbox per row), not a chips-plus-list
 * split: selecting doesn't remove the row or shift the layout, deselecting is
 * the same gesture in the same place, and the running count lives in the slim
 * summary row + the footer's "Add N members" button.
 */
export const AddMembersStep = ({ selectedUsers, onSelectUsers, workspace, excludeUserIds, emptyText }: AddMembersStepProps) => {

    const { myProfile } = useCurrentRavenUser()
    const excludedIds = useMemo(() => new Set(excludeUserIds ?? []), [excludeUserIds])
    // Debounced search text (same pattern as the members drawer's search) — the
    // input below is uncontrolled, this only lags the FILTER, not the typing.
    const [filterText, setFilterText] = useDebounceValue('', 200)

    // Channel members must come from the channel's WORKSPACE, not the whole org —
    // the local users table holds everyone, so intersect it with the workspace's
    // member list.
    const { data: workspaceMembers } = useFrappeGetCall<{ message: { user: string }[] }>(
        'raven.api.workspaces.fetch_workspace_members',
        { workspace },
        workspace ? `workspace_members_${workspace}` : null,
    )
    const workspaceUserIds = useMemo(
        () => {
            if (!workspace) return "all" as const // no workspace scoping — every enabled user is eligible
            return workspaceMembers ? new Set(workspaceMembers.message.map((member) => member.user)) : null
        },
        [workspace, workspaceMembers],
    )

    // Selection does NOT filter the query (rows stay in place, showing checked
    // state) — so it's deliberately absent from the deps.
    const filteredUsers = useLiveQuery<UserData[] | undefined>(() => {
        // Membership list still loading — report "loading" (undefined), not "no users".
        if (!workspaceUserIds) return undefined
        return db.users
            .where('enabled')
            .equals(1)
            .and((user) => workspaceUserIds === "all" || workspaceUserIds.has(user.name))
            .and((user) => user.name !== myProfile?.name)
            .and((user) => !excludedIds.has(user.name))
            .and((user) => user.name.toLowerCase().includes(filterText.toLowerCase()) || user.full_name.toLowerCase().includes(filterText.toLowerCase()))
            .toArray()
            // Alphabetical by DISPLAY name — toArray() alone comes back in primary-key
            // order, which is the user ID, not what anyone scans the list by.
            .then((users) => users.sort((a, b) => (a.full_name || a.name).localeCompare(b.full_name || b.name)))
    },
        [filterText, workspaceUserIds, excludedIds])

    const selectedIds = useMemo(() => new Set(selectedUsers.map((user) => user.name)), [selectedUsers])

    const [announcement, setAnnouncement] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)

    const toggleUser = (user: UserData) => {
        if (selectedIds.has(user.name)) {
            onSelectUsers(selectedUsers.filter((selected) => selected.name !== user.name))
            setAnnouncement(_('{0} removed from selection', [user.full_name]))
        } else {
            onSelectUsers([...selectedUsers, user])
            setAnnouncement(_('{0} added to channel', [user.full_name]))
        }
    }

    // Nobody left to pick at all — everyone is excluded (already a member) before
    // any search. The search box and summary row would just be noise over the
    // empty state, so they hide too. (Selected rows stay listed, so a non-empty
    // selection can never land here.)
    const noOneToAdd = filteredUsers !== undefined && filteredUsers.length === 0 && !filterText && selectedUsers.length === 0

    return (
        // No horizontal padding — the hosting dialog/drawer owns the outer spacing.
        <div className="flex flex-col h-full min-h-0 gap-3">
            {/* Screen reader announcements */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {announcement}
            </div>

            {/* Search — the standard InputGroup search pattern (same as the members drawer) */}
            <div className={cn('shrink-0', noOneToAdd && 'hidden')}>
                <InputGroup size="md" variant="outline">
                    <InputGroupAddon><Search /></InputGroupAddon>
                    <Input
                        ref={searchInputRef}
                        placeholder={_('Search by name or email...')}
                        onChange={(e) => setFilterText(e.target.value)}
                        // Enter while searching must not implicit-submit the hosting
                        // form (which would add the selection and leave the dialog).
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault()
                        }}
                        inputSize="md"
                        type="text"
                        aria-label={_('Search team members')}
                    />
                </InputGroup>
            </div>

            {/* Selection summary — a fixed-height row so appearing/disappearing
                content never shifts the list below. Hovering the count shows WHO is
                selected (desktop only — hover cards don't open on touch, where the
                checked rows in the list carry that information anyway). */}
            <div className={cn('flex h-7 shrink-0 items-center justify-between', noOneToAdd && 'hidden')}>
                {selectedUsers.length === 0 ? (
                    <span className="text-sm text-ink-gray-5">{_('Select members to add')}</span>
                ) : (
                    <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                            <span className="cursor-default text-sm text-ink-gray-5 underline decoration-outline-gray-3 decoration-dotted underline-offset-4">
                                {selectedUsers.length === 1
                                    ? _('1 member selected')
                                    : _('{0} members selected', [String(selectedUsers.length)])}
                            </span>
                        </HoverCardTrigger>
                        <HoverCardContent
                            align="start"
                            className="w-56 p-2"
                            // The hover card portals OUTSIDE the modal create-channel dialog,
                            // whose scroll lock (react-remove-scroll) preventDefaults wheel
                            // events via a bubble-phase document listener — killing wheel
                            // scrolling here. Stopping propagation keeps the event from ever
                            // reaching that listener; native scrolling then just works. (Same
                            // fix as the emoji picker inside the message action sheet.)
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <ScrollArea viewportClassName="max-h-64">
                                {/* pr-1: breathing room under the overlay scrollbar */}
                                <div className="flex flex-col gap-2.5 py-0.5 pr-1">
                                    {selectedUsers.map((user) => (
                                        <div key={user.name} className="flex items-center gap-2">
                                            <UserAvatar user={user} size="xs" className="shrink-0" showStatusIndicator={false} />
                                            <span className="truncate text-sm text-ink-gray-7">{user.full_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </HoverCardContent>
                    </HoverCard>
                )}
                {selectedUsers.length > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            onSelectUsers([])
                            setAnnouncement(_('All members removed from selection'))
                        }}
                    >
                        {_('Clear all')}
                    </Button>
                )}
            </div>

            {/* One toggle list — click a row (anywhere) to select/deselect.
                Four states: loading (workspace membership fetch), the list,
                a search miss, and "no one to add" (everyone excluded). */}
            <div className="flex-1 min-h-0">
                {filteredUsers === undefined ? (
                    <div aria-hidden="true">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="mb-1 flex items-center gap-2.5 rounded-md p-2">
                                <Skeleton className="size-7 shrink-0 rounded-full" />
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <Skeleton className="h-3.5" style={{ width: `${40 + (index % 3) * 15}%` }} />
                                    <Skeleton className="h-3 w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredUsers.length > 0 ? (
                    <Virtuoso
                        style={{ height: '100%', width: '100%' }}
                        data={filteredUsers!}
                        overscan={200}
                        itemContent={(_index, user) => {
                            const isSelected = selectedIds.has(user.name)
                            return (
                                <button
                                    type="button"
                                    onClick={() => toggleUser(user)}
                                    aria-pressed={isSelected}
                                    className={cn(
                                        'mb-1 flex w-full cursor-pointer items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-surface-gray-2',
                                        isSelected && 'bg-surface-gray-1',
                                    )}
                                >
                                    <UserAvatar
                                        user={user}
                                        size="sm"
                                        className="shrink-0"
                                        showStatusIndicator={false}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium leading-tight">
                                            {user.full_name}
                                        </div>
                                        <div className="truncate text-xs text-ink-gray-4 leading-tight">
                                            {user.name}
                                        </div>
                                    </div>
                                    {/* Visual state only — the whole row button is the control
                                        (aria-pressed carries the state). NOT the ui Checkbox: that's
                                        a real <button> (invalid inside this row button), and its
                                        Radix form-sync dispatches a bubbling click on every checked
                                        change — which re-triggered the row's onClick in a loop.
                                        This span mirrors ui/checkbox's checked styling. */}
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'grid size-4 shrink-0 place-content-center rounded-sm border transition',
                                            isSelected
                                                ? 'border-ink-gray-8 bg-ink-gray-8 text-ink-base'
                                                : 'border-outline-gray-4',
                                        )}
                                    >
                                        {isSelected && <CheckIcon className="size-3" />}
                                    </span>
                                </button>
                            )
                        }}
                    />
                ) : filterText ? (
                    <div className="flex h-full items-center justify-center">
                        <Empty>
                            <EmptyMedia><SearchX /></EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>{_('No matches')}</EmptyTitle>
                                <EmptyDescription>{_('No users found matching your search.')}</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <Empty>
                            <EmptyMedia><UsersRound /></EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>{_('No one to add')}</EmptyTitle>
                                <EmptyDescription>
                                    {emptyText ?? _('There is no one else in this workspace to add.')}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </div>
                )}
            </div>
        </div>
    )
}
