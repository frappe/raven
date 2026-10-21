import { useDeferredValue, useMemo, useState } from "react"
import { ChevronDownIcon, SearchIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Checkbox } from "@components/ui/checkbox"
import { Input } from "@components/ui/input"
import { InputGroup, InputGroupAddon } from "@components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { cn } from "@lib/utils"
import { useResetScrollOnSearch } from "@hooks/useResetScrollOnSearch"
import _ from "@lib/translate"

type Props = {
    workspaces: WorkspaceFields[]
    /** Channels the admin can add people to, grouped by workspace id. */
    channelsByWorkspace: Map<string, ChannelListItem[]>
    selectedWorkspaces: string[]
    onWorkspacesChange: (value: string[]) => void
    selectedChannels: string[]
    onChannelsChange: (value: string[]) => void
    /** Channels the user is in that the caller cannot remove them from (not a channel admin). Shown ticked and locked. */
    lockedChannels?: Set<string>
    disabled?: boolean
}

/** Above this many channels a workspace's list gets a search box. */
const SEARCH_THRESHOLD = 8

/**
 * A tree of workspaces with a checkbox each. A ticked workspace can expand to
 * show its channels, so channel picks stay next to the workspace they belong to.
 */
export const WorkspaceAccessPicker = ({
    workspaces, channelsByWorkspace, selectedWorkspaces, onWorkspacesChange, selectedChannels, onChannelsChange, lockedChannels, disabled,
}: Props) => {
    const [expanded, setExpanded] = useState<string[]>([])

    const toggleWorkspace = (workspace: string, checked: boolean) => {
        if (checked) {
            onWorkspacesChange([...selectedWorkspaces, workspace])
            return
        }
        onWorkspacesChange(selectedWorkspaces.filter((w) => w !== workspace))
        // Unticking a workspace drops its channel picks too.
        const its = new Set((channelsByWorkspace.get(workspace) ?? []).map((c) => c.name))
        if (selectedChannels.some((c) => its.has(c))) onChannelsChange(selectedChannels.filter((c) => !its.has(c)))
        setExpanded((prev) => prev.filter((w) => w !== workspace))
    }

    const toggleExpanded = (workspace: string) => {
        setExpanded((prev) => (prev.includes(workspace) ? prev.filter((w) => w !== workspace) : [...prev, workspace]))
    }

    return (
        <div className="flex flex-col gap-0.5 -mx-2">
            {workspaces.map((workspace) => {
                const checked = selectedWorkspaces.includes(workspace.name)
                // Only workspace admins can add or remove members. Others still see the
                // membership and, when the user is in the workspace, can manage its channels.
                const canEditMembership = Boolean(workspace.is_admin)
                const channels = channelsByWorkspace.get(workspace.name) ?? []
                const pickedCount = channels.filter((c) => selectedChannels.includes(c.name)).length
                const isOpen = checked && expanded.includes(workspace.name)
                const row = (
                    <label className="relative flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 has-[:disabled]:cursor-not-allowed">
                        <Checkbox
                            checked={checked}
                            disabled={disabled || !canEditMembership}
                            onCheckedChange={(v) => toggleWorkspace(workspace.name, v === true)}
                        />
                        <Avatar className="h-5 w-5 shrink-0 rounded-sm">
                            <AvatarImage src={workspace.logo} alt={workspace.workspace_name} />
                            <AvatarFallback className="rounded-sm text-xs bg-surface-gray-2 text-ink-gray-7">
                                {workspace.workspace_name?.charAt(0)?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-base text-ink-gray-8">{workspace.workspace_name}</span>
                    </label>
                )
                return (
                    <div key={workspace.name}>
                        {/* Fixed height so the channels toggle appearing never shifts the row. */}
                        <div className="flex h-9 items-center gap-2 rounded px-2 hover:bg-surface-gray-2">
                            {canEditMembership ? row : (
                                // The disabled checkbox swallows pointer events, so the label carries the tooltip.
                                <Tooltip>
                                    <TooltipTrigger asChild>{row}</TooltipTrigger>
                                    <TooltipContent>
                                        {_("You are not an admin of this workspace, so you cannot manage it's members.")}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {checked && channels.length > 0 && (
                                // Plain text toggle: no background of its own, so the row hover stays one colour.
                                <button
                                    type="button"
                                    disabled={disabled}
                                    aria-expanded={isOpen}
                                    onClick={() => toggleExpanded(workspace.name)}
                                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded text-p-sm text-ink-gray-6 hover:text-ink-gray-8 disabled:cursor-not-allowed disabled:text-ink-gray-4"
                                >
                                    {pickedCount === 0
                                        ? _("Select channels")
                                        : pickedCount === 1
                                            ? _("1 channel")
                                            : _("{0} channels", [String(pickedCount)])}
                                    <ChevronDownIcon className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                                </button>
                            )}
                        </div>
                        {isOpen && (
                            <ChannelList
                                channels={channels}
                                selected={selectedChannels}
                                onChange={onChannelsChange}
                                locked={lockedChannels}
                                disabled={disabled}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/** One workspace's channels: an optional search box over a clamped checkbox list. */
const ChannelList = ({
    channels, selected, onChange, locked, disabled,
}: { channels: ChannelListItem[]; selected: string[]; onChange: (v: string[]) => void; locked?: Set<string>; disabled?: boolean }) => {
    const [search, setSearch] = useState("")
    const query = useDeferredValue(search.trim().toLowerCase())
    // The clamped list keeps its scroll offset when filtered. Start each search at the top.
    const listRef = useResetScrollOnSearch(query)
    const visible = useMemo(
        () => (query ? channels.filter((c) => c.channel_name.toLowerCase().includes(query)) : channels),
        [channels, query],
    )

    const toggle = (name: string, checked: boolean) => {
        onChange(checked ? [...selected, name] : selected.filter((v) => v !== name))
    }

    return (
        <div className="mt-1 mb-2 ml-8 mr-2 flex flex-col gap-2">
            {channels.length > SEARCH_THRESHOLD && (
                <InputGroup size="sm" variant="outline">
                    <InputGroupAddon><SearchIcon /></InputGroupAddon>
                    <Input
                        inputSize="sm"
                        type="search"
                        placeholder={_("Search channels")}
                        aria-label={_("Search channels")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        // Enter here must not submit the invite form.
                        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
                    />
                </InputGroup>
            )}
            {/* Rows are `relative`: inside a form, Radix checkboxes render a hidden absolutely
                positioned input. Without a positioned row it escapes this clamped list and
                stretches the dialog's scroll area by the list's full height. */}
            <div ref={listRef} className="scroll-fade flex max-h-56 flex-col gap-1 overflow-y-auto">
                {visible.length === 0 && (
                    <p className="px-2 py-1.5 text-p-sm text-ink-gray-5">{_("No channels match your search.")}</p>
                )}
                {visible.map((channel) => {
                    const isLocked = locked?.has(channel.name) ?? false
                    const row = (
                        <label className="relative flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 hover:bg-surface-gray-2 has-[:disabled]:cursor-not-allowed">
                            <Checkbox
                                checked={selected.includes(channel.name)}
                                disabled={disabled || isLocked}
                                onCheckedChange={(v) => toggle(channel.name, v === true)}
                            />
                            <ChannelIcon type={channel.type} className="size-4 shrink-0 text-ink-gray-6" />
                            <span className="truncate text-sm leading-snug text-ink-gray-8">{channel.channel_name}</span>
                        </label>
                    )
                    if (!isLocked) return <div key={channel.name}>{row}</div>
                    // The disabled checkbox swallows pointer events, so the label carries the tooltip.
                    return (
                        <Tooltip key={channel.name}>
                            <TooltipTrigger asChild>{row}</TooltipTrigger>
                            <TooltipContent>
                                {_("You are not an admin of this channel, so you cannot remove its members.")}
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </div>
        </div>
    )
}

export default WorkspaceAccessPicker
