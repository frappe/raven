import { useMemo } from "react"
import { CommandGroup } from "@components/ui/command"
import { FilterCombobox, FilterComboboxItem } from "./FilterCombobox"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { cn } from "@lib/utils"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import { UserData } from "@db"
import { getUserDisplayName, isCurrentUser } from "@utils/userDisplay"
import _ from "@lib/translate"
import { useWorkspaces } from "@hooks/useWorkspaces"

export type ChannelFilterItem = ChannelListItem | DMChannelListItem

/** Sentinel for "no channel filter". Not a real channel id. */
const ALL = "*all"

interface ChannelFilterProps {
    /** Regular channels */
    channels: ChannelListItem[]
    /** DM channels */
    dmChannels?: DMChannelListItem[]
    /** Users for resolving DM peer names/avatars (optional; falls back to peer_user_id when empty) */
    users?: UserData[]
    value: string
    onValueChange: (value: string) => void
    /** Label for the "no filter" option. */
    allLabel?: string
    /** The trigger's width, which its row decides. The popover doesn't follow it. */
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the filter can flex down in a shared row. */
    className?: string
}

/**
 * The selectable rows alone — shared by the desktop combobox below and the
 * mobile drill-in sheet (SearchFiltersSheet), so the two surfaces show one
 * list. Must render inside a cmdk <Command>; pass the live search text so
 * the list can flatten while a search runs.
 */
export function ChannelFilterRows({
    channels,
    dmChannels,
    users,
    value,
    search,
    onSelect,
}: {
    channels: ChannelListItem[]
    dmChannels?: DMChannelListItem[]
    users?: UserData[]
    value: string
    search: string
    onSelect: (name: string) => void
}) {
    const channelsByWorkspace = useMemo(() => {
        const groups = new Map<string, ChannelListItem[]>()
        for (const channel of channels) {
            const key = channel.workspace ?? ""
            const list = groups.get(key)
            if (list) list.push(channel)
            else groups.set(key, [channel])
        }
        return Array.from(groups.entries())
    }, [channels])

    // Headings used to render the raw workspace ID. The list is a shared SWR key already
    // fetched app-wide, so resolving names here is a cache read, not a request.
    const { workspaces } = useWorkspaces()
    const workspaceNames = useMemo(
        () => new Map(workspaces.map((workspace) => [workspace.name, workspace.workspace_name])),
        [workspaces],
    )

    const item = (channel: ChannelFilterItem, workspaceName?: string) => (
        <ChannelCommandItem
            key={channel.name}
            channel={channel}
            users={users}
            selected={value === channel.name}
            onSelect={() => onSelect(channel.name)}
            workspaceName={workspaceName}
        />
    )

    // Searching flattens the list into one group. cmdk ranks items by score
    // within a group but leaves the groups themselves in render order, so a
    // weak fuzzy match in the first workspace outranked an exact match in the
    // second — searching "memes" put the exact channel 7th, below
    // "framework-bug-triaging-sprint". One group means one ranking, and each
    // row carries the workspace the heading would have told you.
    if (search) {
        return (
            <CommandGroup>
                {channels.map((channel) => item(
                    channel,
                    channel.workspace ? workspaceNames.get(channel.workspace) ?? channel.workspace : undefined,
                ))}
                {dmChannels?.map((dm) => item(dm, _("Direct Message")))}
            </CommandGroup>
        )
    }

    // Idle: grouped by workspace, which is how you browse rather than search.
    return (
        <>
            {channelsByWorkspace.map(([workspaceID, workspaceChannels]) => (
                <CommandGroup key={workspaceID} heading={workspaceNames.get(workspaceID) ?? workspaceID}>
                    {/* Arrow, not a bare reference: map would pass the index as
                        the workspace name. */}
                    {workspaceChannels.map((channel) => item(channel))}
                </CommandGroup>
            ))}
            {dmChannels && dmChannels.length > 0 && (
                <CommandGroup heading={_("Direct Messages")}>
                    {dmChannels.map((dm) => item(dm))}
                </CommandGroup>
            )}
        </>
    )
}

/** Channel + DM picker for the filter bars. */
export function ChannelFilter({
    channels,
    dmChannels,
    users,
    value,
    onValueChange,
    allLabel = _("Any Channel"),
    triggerClassName,
    className,
}: ChannelFilterProps) {
    const selectedChannel = useMemo(() => {
        if (!value || value === ALL) return null
        return channels.find((channel) => channel.name === value)
            ?? dmChannels?.find((dm) => dm.name === value)
            ?? null
    }, [value, channels, dmChannels])

    return (
        <FilterCombobox
            className={className}
            triggerClassName={triggerClassName}
            emptyLabel={_("No channels or DMs found.")}
            // Only while a channel is picked — the trigger shows a clear button in place of
            // its chevron, which is the sole way back to unfiltered on pages without the
            // active-filter badges (threads, saved messages).
            onClear={selectedChannel ? () => onValueChange(ALL) : undefined}
            trigger={
                selectedChannel ? (
                    <ChannelOption channel={selectedChannel} users={users} compact />
                ) : (
                    <span className="min-w-0 flex-1 truncate text-left leading-snug text-ink-gray-4">{allLabel}</span>
                )
            }
        >
            {(close, search) => (
                <ChannelFilterRows
                    channels={channels}
                    dmChannels={dmChannels}
                    users={users}
                    value={value}
                    search={search}
                    onSelect={(name) => { onValueChange(name); close() }}
                />
            )}
        </FilterCombobox>
    )
}

function ChannelCommandItem({
    channel, users, selected, onSelect, workspaceName,
}: {
    channel: ChannelFilterItem
    users?: UserData[]
    selected: boolean
    onSelect: () => void
    /** Shown on the row itself when the list is flat and has no workspace headings. */
    workspaceName?: string
}) {
    return (
        <FilterComboboxItem
            // The channel id is the identity — unique per doctype, so two channels sharing
            // a name stay separate rows. The visible name is what gets ranked.
            value={channel.name}
            keywords={[getChannelLabel(channel, users)]}
            selected={selected}
            onSelect={onSelect}
        >
            <ChannelOption channel={channel} users={users} workspaceName={workspaceName} />
        </FilterComboboxItem>
    )
}

export function getChannelLabel(channel: ChannelFilterItem, users?: UserData[]): string {
    if (channel.is_direct_message === 1) {
        const dm = channel as DMChannelListItem
        return users?.find((user) => user.name === dm.peer_user_id)?.full_name ?? dm.peer_user_id ?? channel.name
    }
    return channel.channel_name ?? channel.name ?? ""
}

/** One channel/DM row — shared with the forward dialog's recipient picker. */
export function ChannelOption({
    channel, users, compact = false, workspaceName,
}: { channel: ChannelFilterItem; users?: UserData[]; compact?: boolean; workspaceName?: string }) {
    const isDM = channel.is_direct_message === 1
    const peerUser = users?.find((user) => user.name === (channel as DMChannelListItem).peer_user_id)

    // Your own DM (the note-to-self conversation) reads "<name> (You)", the same as it does
    // in the DM sidebar. Applied HERE and not in getChannelLabel, because that label is also
    // the row's cmdk `keywords` — a search for "you" must not match your own DM.
    const isSelfDM = isDM && isCurrentUser((channel as DMChannelListItem).peer_user_id)

    // min-w-0 + flex-1 in BOTH modes: as a list row this has to be able to shrink,
    // or it overflows the item and pushes the trailing check out of the popover.
    return (
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {isDM ? (
                peerUser ? (
                    <UserAvatar user={peerUser} size={compact ? "xs" : "sm"} showStatusIndicator={false} showBotIndicator={false} />
                ) : (
                    <span className={cn(
                        "flex shrink-0 items-center justify-center rounded bg-surface-gray-2 text-xs font-bold text-ink-gray-5",
                        compact ? "size-4" : "size-6",
                    )}>
                        ?
                    </span>
                )
            ) : (
                <ChannelIcon
                    type={(channel as ChannelListItem).type as "Public" | "Private" | "Open"}
                    className="size-4 shrink-0 text-ink-gray-6"
                />
            )}
            {/* leading-snug: the UI type scale's 1.15 is too tight to contain descenders
                once `truncate` clips the line box. */}
            <span className="min-w-0 flex-1 truncate text-left leading-snug">
                {getUserDisplayName(getChannelLabel(channel, users), isSelfDM)}
            </span>
            {/* Stands in for the group heading while the list is flat: two channels can share
                a name across workspaces, and a ranked result is useless if you can't tell
                which one it is. max-w keeps a long workspace name from eating the channel.

                Dropped on your own DM, where this slot only ever says "Direct Message" — the
                avatar already conveys that, and both together don't fit: this slot is
                shrink-0 while the name truncates, so the name yields first and the "(You)"
                gets clipped off the row that most needed it. */}
            {workspaceName && !isSelfDM && (
                <span className="shrink-0 max-w-24 truncate text-sm leading-snug text-ink-gray-4">
                    {workspaceName}
                </span>
            )}
        </div>
    )
}
