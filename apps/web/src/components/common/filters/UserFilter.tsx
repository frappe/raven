import { useMemo } from 'react'
import { CommandGroup } from '@components/ui/command'
import { FilterCombobox, FilterComboboxItem } from './FilterCombobox'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { UserData } from "@db"
import { getUserDisplayName, isCurrentUser } from '@utils/userDisplay'
import _ from '@lib/translate'

/** Sentinel for "no author filter". Not a real user id. */
const ALL = 'all'

/**
 * Full names shared by more than one account — common enough on a real directory to matter.
 * cmdk can tell such rows apart on its own (the value is the user id), but a reader can't.
 * Callers show the id as secondary text on exactly these rows and nowhere else.
 */
export const getAmbiguousNames = (users: UserData[]): Set<string> => {
    const seen = new Set<string>()
    const duplicated = new Set<string>()
    for (const user of users) {
        const name = user.full_name ?? user.name
        if (seen.has(name)) duplicated.add(name)
        else seen.add(name)
    }
    return duplicated
}

interface UserFilterProps {
    users: UserData[]
    value: string
    onValueChange: (value: string) => void
    /** Trigger text while nothing is picked. Callers with a label above the
     *  field pass something like "Anyone" so the word isn't said twice. */
    placeholder?: string
    /** The trigger's width, which its row decides. The popover doesn't follow it. */
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the filter can flex down in a shared row. */
    className?: string
}

/**
 * The selectable rows alone — shared by the desktop combobox below and the
 * mobile drill-in sheet (SearchFiltersSheet), so the two surfaces show one
 * list. Must render inside a cmdk <Command>.
 */
export function UserFilterRows({
    users,
    value,
    onSelect,
}: {
    users: UserData[]
    value: string
    onSelect: (name: string) => void
}) {
    // Three tiers: people you can still hear from, then deactivated accounts, then bots.
    // A bot posts constantly but is rarely who you're filtering for, and a deactivated
    // account has a fixed, finite history — neither should sit above a colleague. Ties
    // break by name so the list is stable between opens rather than in fetch order.
    // Only the browse order: a search hands ranking to cmdk's scoring.
    const orderedUsers = useMemo(() => {
        const rank = (user: UserData) => (user.type === 'Bot' ? 2 : user.enabled ? 0 : 1)
        return [...users].sort((a, b) =>
            rank(a) - rank(b) || (a.full_name ?? a.name).localeCompare(b.full_name ?? b.name),
        )
    }, [users])

    const ambiguousNames = useMemo(() => getAmbiguousNames(users), [users])

    return (
        // Only users in this list — a "Users" heading labels nothing. The group stays
        // for its p-1 gutter; cmdk renders no heading element when the prop is absent.
        <CommandGroup>
            {orderedUsers.map((user) => {
                const name = user.full_name ?? user.name
                const isAmbiguous = ambiguousNames.has(name)
                return (
                    <FilterComboboxItem
                        key={user.name}
                        // The user id is the identity — unique per doctype, so two
                        // people with one name stay separate rows. The name is what
                        // gets ranked.
                        value={user.name}
                        keywords={[name]}
                        selected={value === user.name}
                        onSelect={() => onSelect(user.name)}
                    >
                        <UserOption user={user} secondary={isAmbiguous ? user.name : undefined} />
                    </FilterComboboxItem>
                )
            })}
        </CommandGroup>
    )
}

/** Message-author picker for the filter bars. */
export function UserFilter({
    users,
    value,
    onValueChange,
    placeholder,
    triggerClassName,
    className,
}: UserFilterProps) {
    const selectedUser = users.find((user) => user.name === value)
    const isAllSelected = !value || value === ALL

    return (
        <FilterCombobox
            className={className}
            triggerClassName={triggerClassName}
            emptyLabel={_("No users found.")}
            // Only while an author is picked — see ChannelFilter.
            onClear={selectedUser && !isAllSelected ? () => onValueChange(ALL) : undefined}
            trigger={
                selectedUser && !isAllSelected ? (
                    <UserOption user={selectedUser} compact />
                ) : (
                    <span className="min-w-0 flex-1 truncate text-left leading-snug text-ink-gray-4">
                        {placeholder ?? _("Person")}
                    </span>
                )
            }
        >
            {(close) => (
                <UserFilterRows
                    users={users}
                    value={value}
                    onSelect={(name) => { onValueChange(name); close() }}
                />
            )}
        </FilterCombobox>
    )
}

/** One person row — shared with the forward dialog's recipient picker. */
export function UserOption({ user, compact = false, secondary }: { user: UserData; compact?: boolean; secondary?: string }) {
    // Your own row reads "<name> (You)", the same as it does in the DM sidebar. The suffix
    // is applied HERE and not in the row's `keywords`, so searching "you" can't match
    // every self row.
    const isSelf = isCurrentUser(user.name)

    return (
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <UserAvatar
                user={user}
                size={compact ? 'xs' : 'sm'}
                showStatusIndicator={false}
                showBotIndicator={false}
            />
            {/* leading-snug: the UI type scale's 1.15 clips descenders once truncate
                bounds the line box. */}
            <span className="min-w-0 flex-1 truncate text-left leading-snug">
                {getUserDisplayName(user.full_name ?? user.name, isSelf)}
            </span>
            {/* Only set when another account shares this name: the id is the sole thing
                distinguishing the two rows.

                Suppressed on your OWN row, where "(You)" already does that job and does it
                better. Both together don't fit: this slot is shrink-0 while the name
                truncates, so in a w-64 popover the name yields first and the "(You)" gets
                clipped off the row that most needed it. */}
            {secondary && !isSelf && (
                <span className="shrink-0 max-w-32 truncate text-sm leading-snug text-ink-gray-4">
                    {secondary}
                </span>
            )}
        </div>
    )
}
