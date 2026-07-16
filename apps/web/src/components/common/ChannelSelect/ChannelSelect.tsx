import { useMemo, useRef, useState } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectSeparator,
    SelectLabel,
    SelectGroup,
} from "@components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@components/ui/command"
import { Button } from "@components/ui/button"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { Label } from "@components/ui/label"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@lib/utils"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import { UserData } from "@db"
import _ from "@lib/translate"

export type ChannelSelectItem = ChannelListItem | DMChannelListItem

interface ChannelSelectProps {
    /** Regular channels */
    channels: ChannelListItem[]
    /** DM channels */
    dmChannels?: DMChannelListItem[]
    /** Users for resolving DM peer names/avatars (optional; falls back to peer_user_id when empty) */
    users?: UserData[]
    value: string
    onValueChange: (value: string) => void
    /** Placeholder when nothing selected */
    placeholder?: string
    /** Show "In Any Channel" / "All" option */
    allowAll?: boolean
    allLabel?: string
    /** Size variant */
    size?: "sm" | "default"
    /** Dropdown content width */
    dropdownClassName?: string
    /** Trigger button width — defaults to dropdownClassName when omitted. */
    triggerClassName?: string
    /** Show label above */
    showLabel?: boolean
    label?: string
    /** Use searchable combobox (better for long lists) */
    searchable?: boolean
    /** Extra classes for the component root wrapper — e.g. width / shrink control so the
     *  select can flex down instead of overflowing when sharing a row. */
    className?: string
}

export function ChannelSelect({
    channels,
    dmChannels,
    users,
    value,
    onValueChange,
    placeholder = "Select channel",
    allowAll = false,
    allLabel = "In Any Channel",
    size = "default",
    dropdownClassName,
    triggerClassName,
    showLabel = false,
    label = "Channel",
    searchable = false,
    className,
}: ChannelSelectProps) {

    const selectedChannel = useMemo(() => {
        if (!value || value === "*all") return null
        const ch = channels.find((c) => c.name === value)
        if (ch) return ch
        return dmChannels?.find((d) => d.name === value) ?? null
    }, [value, channels, dmChannels])

    const triggerSizeClass = size === "sm" ? "!h-7 !py-1 [&>span]:!px-0" : "!h-9 !py-2 [&>span]:!px-0"
    const paddingClass =
        selectedChannel && value !== "*all"
            ? size === "sm"
                ? "!px-2"
                : "!px-3"
            : size === "sm"
                ? "!pl-3 !pr-2"
                : "!pl-4 !pr-3"

    const content = (
        <>
            {allowAll && (
                <SelectItem value="*all" textValue={allLabel}>
                    {allLabel}
                </SelectItem>
            )}
            <SelectGroup>
                <SelectLabel className="text-xs text-ink-gray-4/80 px-2 py-1.5">
                    {_("Channels")}
                </SelectLabel>
                {channels.map((ch) => (
                    <SelectItem
                        key={ch.name}
                        value={ch.name}
                        textValue={getChannelLabel(ch, users)}
                    >
                        <ChannelOption channel={ch} users={users} />
                    </SelectItem>
                ))}
            </SelectGroup>
            {dmChannels && dmChannels.length > 0 && (
                <>
                    <SelectSeparator />
                    <SelectGroup>
                        <SelectLabel className="text-xs text-ink-gray-4/80 px-2 py-1.5">
                            {_("Direct Messages")}
                        </SelectLabel>
                        {dmChannels.map((dm) => (
                            <SelectItem
                                key={dm.name}
                                value={dm.name}
                                textValue={getChannelLabel(dm, users)}
                            >
                                <ChannelOption channel={dm} users={users} />
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </>
            )}
        </>
    )

    const triggerContent = selectedChannel && value !== "*all" ? (
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            <ChannelOption channel={selectedChannel} users={users} compact={size === "sm"} />
        </div>
    ) : (
        <SelectValue placeholder={placeholder} className="pl-1" />
    )

    if (searchable) {
        return (
            <ChannelSelectCombobox
                channels={channels}
                dmChannels={dmChannels}
                users={users}
                value={value}
                onValueChange={onValueChange}
                placeholder={placeholder}
                allowAll={allowAll}
                allLabel={allLabel}
                showLabel={showLabel}
                label={label}
                dropdownClassName={dropdownClassName}
                triggerClassName={triggerClassName}
                triggerSizeClass={triggerSizeClass}
                paddingClass={paddingClass}
                className={className}
            />
        )
    }

    return (
        <div className={cn("shrink-0", className)}>
            {showLabel && (
                <Label className="mb-1 block text-xs text-ink-gray-4">{label}</Label>
            )}
            <Select value={value || (allowAll ? "*all" : "")} onValueChange={onValueChange}>
                <SelectTrigger
                    className={cn(
                        "w-fit [&>span]:text-inherit",
                        triggerSizeClass,
                        paddingClass,
                        triggerClassName ?? dropdownClassName
                    )}
                >
                    {triggerContent}
                </SelectTrigger>
                <SelectContent className={dropdownClassName || "w-full"}>
                    {content}
                </SelectContent>
            </Select>
        </div>
    )
}

function getChannelLabel(
    ch: ChannelSelectItem | DMChannelListItem,
    users?: UserData[]
): string {
    if (ch.is_direct_message === 1) {
        const dm = ch as DMChannelListItem
        const peer = users?.find((u) => u.name === dm.peer_user_id)
        return peer?.full_name ?? dm.peer_user_id ?? ch.name
    }
    return ch.channel_name ?? ch.name ?? ""
}

function ChannelOption({ channel, users, compact = false }: { channel: ChannelSelectItem | DMChannelListItem, users?: UserData[], compact?: boolean }) {
    const isDM = channel.is_direct_message === 1
    const dmChannel = channel as DMChannelListItem
    const peerUser = users?.find((u) => u.name === dmChannel.peer_user_id)
    const label = getChannelLabel(channel, users)
    const avatarSize = compact ? "xs" : "sm"
    const fallbackSize = compact ? "h-4 w-4" : "h-6 w-6"

    return (
        <div className={cn("flex items-center gap-2", compact && "min-w-0 flex-1 overflow-hidden")}>
            {isDM ? (
                peerUser ? (
                    <UserAvatar
                        user={peerUser}
                        size={avatarSize}
                        showStatusIndicator={false}
                        showBotIndicator={false}
                    />
                ) : (
                    <span className={cn("flex items-center justify-center rounded bg-surface-gray-2 text-xs font-bold text-ink-gray-4 shrink-0", fallbackSize)}>
                        ?
                    </span>
                )
            ) : (
                <ChannelIcon
                    type={(channel as ChannelListItem).type as "Public" | "Private" | "Open"}
                    className="h-4 w-4 text-ink-gray-4 shrink-0"
                />
            )}
            <span className={cn("truncate text-left", compact ? "min-w-0 flex-1" : "max-w-50")}>{label}</span>
        </div>
    )
}


/** Searchable combobox variant */
function ChannelSelectCombobox({
    channels,
    dmChannels,
    users,
    value,
    onValueChange,
    placeholder,
    allowAll,
    allLabel,
    showLabel,
    label,
    dropdownClassName,
    triggerClassName,
    triggerSizeClass,
    paddingClass,
    className,
}: Omit<ChannelSelectProps, "size"> & {
    triggerSizeClass: string
    paddingClass: string
}) {
    const [open, setOpen] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const selectedChannel = useMemo(() => {
        if (!value || value === "*all") return null
        const ch = channels.find((c) => c.name === value)
        if (ch) return ch
        return dmChannels?.find((d) => d.name === value) ?? null
    }, [value, channels, dmChannels])

    const channelsByWorkspace = useMemo(() => {
        const groups = new Map<string, ChannelListItem[]>()
        for (const ch of channels) {
            const key = ch.workspace ?? ""
            const list = groups.get(key)
            if (list) list.push(ch)
            else groups.set(key, [ch])
        }
        return Array.from(groups.entries())
    }, [channels])

    const isAllSelected = allowAll && (!value || value === "*all")
    const isCompact = triggerSizeClass.includes("!h-7")
    const triggerContent = selectedChannel && value !== "*all" ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
            <ChannelOption channel={selectedChannel} users={users} compact={isCompact} />
        </div>
    ) : isAllSelected ? (
        <span className="min-w-0 flex-1 truncate text-left text-ink-gray-4">{allLabel}</span>
    ) : (
        <span className="min-w-0 flex-1 truncate text-left text-ink-gray-4">{placeholder}</span>
    )

    return (
        <div className={cn("shrink-0", className)}>
            {showLabel && (
                <Label className="mb-1 block text-xs text-ink-gray-4">{label}</Label>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-fit justify-between font-normal gap-2 overflow-hidden",
                            triggerSizeClass,
                            paddingClass,
                            triggerClassName ?? dropdownClassName
                        )}
                    >
                        {triggerContent}
                        <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    side="bottom"
                    align="start"
                    className={cn("w-fit min-w-(--radix-popover-trigger-width) max-h-100 p-0 flex flex-col", dropdownClassName)}
                >
                    <Command shouldFilter={true} className="flex-1 min-h-0">
                        <CommandInput placeholder="Search channels and DMs..." className="focus:ring-0 border-0 bg-transparent" />
                        <div
                            ref={scrollRef}
                            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                            onWheel={(e) => {
                                const el = scrollRef.current
                                if (el) {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    el.scrollTop += e.deltaY
                                }
                            }}
                        >
                            <CommandList className="max-h-none overflow-visible">
                                <CommandEmpty>{_("No channels or DMs found.")}</CommandEmpty>
                                {allowAll && (
                                    <CommandGroup>
                                        <CommandItem value="*all" onSelect={() => { onValueChange("*all"); setOpen(false); }} className="justify-between">
                                            <span>{allLabel}</span>
                                            {(!value || value === "*all") && <CheckIcon className="h-4 w-4 opacity-70" />}
                                        </CommandItem>
                                    </CommandGroup>
                                )}
                                {channelsByWorkspace.map(([workspaceId, wsChannels]) => (
                                    <CommandGroup key={workspaceId} heading={workspaceId}>
                                        {wsChannels.map((ch) => (
                                            <CommandItem
                                                key={ch.name}
                                                value={`${ch.name} ${getChannelLabel(ch, users)}`}
                                                onSelect={() => {
                                                    onValueChange(ch.name)
                                                    setOpen(false)
                                                }}
                                                className="justify-between"
                                            >
                                                <ChannelOption channel={ch} users={users} />
                                                {value === ch.name && <CheckIcon className="h-4 w-4 opacity-70" />}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                ))}
                                {dmChannels && dmChannels.length > 0 && (
                                    <CommandGroup heading="Direct Messages">
                                        {dmChannels.map((dm) => (
                                            <CommandItem
                                                key={dm.name}
                                                value={`${dm.name} ${getChannelLabel(dm, users)}`}
                                                onSelect={() => {
                                                    onValueChange(dm.name)
                                                    setOpen(false)
                                                }}
                                                className="justify-between"
                                            >
                                                <ChannelOption channel={dm} users={users} />
                                                {value === dm.name && <CheckIcon className="h-4 w-4 opacity-70" />}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </div>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
