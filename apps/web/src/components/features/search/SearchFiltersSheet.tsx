import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { Command as CommandPrimitive } from 'cmdk'
import { Command, CommandEmpty, CommandList } from '@components/ui/command'
import { Input } from '@components/ui/input'
import { InputGroup, InputGroupAddon } from '@components/ui/input-group'
import { DrawerClose, DrawerContent, DrawerDescription, DrawerNested, DrawerTitle, DrawerTrigger } from '@components/ui/drawer'
import { ChannelFilterRows } from '@components/common/filters/ChannelFilter'
import { UserFilterRows } from '@components/common/filters/UserFilter'
import { FILE_TYPE_OPTIONS } from '@components/common/filters/FileTypeFilter'
import { PROVIDER_CATEGORIES } from '@components/common/filters/ProviderFilter'
import { scoreFilterRow } from '@components/common/filters/filterScore'
import { BrandIcon } from '@components/features/message/renderers/BrandIcons'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { SearchFilters as SearchFiltersType } from './types'
import { useClearSearchFilters } from './useClearSearchFilters'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import { useUsers } from '@hooks/useUsers'
import { useChannelMembers } from '@hooks/useChannelMembers'
import { cn } from '@lib/utils'
import _ from '@lib/translate'
import { Button } from '@components/ui/button'

/**
 * The mobile filter sheet. Same state as the desktop popover
 * (SearchFiltersBar), different furniture for a thumb:
 *
 *  - Person and Channel are unbounded, searchable lists — they DRILL IN
 *    to a nested drawer with a search field, instead of floating a
 *    combobox popover over the sheet (whose keyboard shoved everything
 *    around).
 *  - File type and provider are bounded sets with icons — they render
 *    INLINE as toggle chips. A sheet the user deliberately opened is the
 *    space; hiding five options behind another dropdown is ceremony.
 */

interface SearchFiltersSheetProps {
    filters: SearchFiltersType
    channels: ChannelListItem[]
    dmChannels: DMChannelListItem[]
    onChannelChange: (value: string) => void
    onUserChange: (value: string) => void
    onFileTypeChange: (value: string[]) => void
    onProviderChange: (value: string[]) => void
    showFileTypeFilter?: boolean
    showProviderFilter?: boolean
}

export function SearchFiltersSheet({
    filters,
    channels,
    dmChannels,
    onChannelChange,
    onUserChange,
    onFileTypeChange,
    onProviderChange,
    showFileTypeFilter,
    showProviderFilter,
}: SearchFiltersSheetProps) {
    const users = useUsers()
    const { members, isLoading: isMembersLoading } = useChannelMembers(filters.channel_id || '')
    const userOptions = filters.channel_id && members.length > 0 ? members : users

    // Same rule as the desktop popover: with a channel picked, the person
    // filter must be one of its members, else it clears.
    useEffect(() => {
        if (!filters.channel_id) return
        if (!filters.owner || filters.owner === 'all') return
        if (isMembersLoading) return
        if (members.some((member) => member.name === filters.owner)) return
        onUserChange('')
    }, [filters.channel_id, filters.owner, members, isMembersLoading, onUserChange])

    const selectedUser = users.find((user) => user.name === filters.owner)
    const selectedChannel =
        channels.find((channel) => channel.name === filters.channel_id) ??
        dmChannels.find((dm) => dm.name === filters.channel_id)
    const selectedIsDM = selectedChannel?.is_direct_message === 1
    const selectedPeer = selectedIsDM
        ? users.find((user) => user.name === (selectedChannel as DMChannelListItem).peer_user_id)
        : undefined
    const selectedChannelLabel = selectedChannel
        ? (selectedChannel as ChannelListItem).channel_name ??
        selectedPeer?.full_name ??
        filters.channel_id
        : undefined

    // The rows show the picked person and channel as they look in their
    // lists — avatar and channel icon, not a bare name.
    const userValue = selectedUser ? (
        <span className="flex min-w-0 items-center gap-1.5">
            <UserAvatar user={selectedUser} size="xs" showStatusIndicator={false} showBotIndicator={false} />
            <span className="min-w-0 truncate leading-snug">{selectedUser.full_name}</span>
        </span>
    ) : undefined

    const channelValue = selectedChannel ? (
        <span className="flex min-w-0 items-center gap-1.5">
            {selectedIsDM ? (
                selectedPeer && (
                    <UserAvatar user={selectedPeer} size="xs" showStatusIndicator={false} showBotIndicator={false} />
                )
            ) : (
                <ChannelIcon
                    type={(selectedChannel as ChannelListItem).type as 'Public' | 'Private' | 'Open'}
                    className="size-4 shrink-0 text-ink-gray-7"
                />
            )}
            <span className="min-w-0 truncate leading-snug">{selectedChannelLabel}</span>
        </span>
    ) : undefined

    const fileTypes = filters.file_type ?? []
    const providers = filters.link_provider ?? []

    const toggle = (list: string[], id: string, onChange: (next: string[]) => void) =>
        onChange(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

    const clearAll = useClearSearchFilters()
    const anyActive =
        !!filters.channel_id || !!filters.owner || fileTypes.length > 0 || providers.length > 0

    return (
        <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain pb-8">
            <DrillIn
                label={_('Person')}
                valueLabel={userValue}
                title={_('Person')}
                emptyLabel={_('No users found.')}
                clearLabel={_('Anyone')}
                onClear={filters.owner ? () => onUserChange('') : undefined}
            >
                {(search, close) => (
                    <UserFilterRows
                        users={userOptions}
                        value={filters.owner || ''}
                        onSelect={(name) => { onUserChange(name); close() }}
                    />
                )}
            </DrillIn>
            <DrillIn
                label={_('Channel')}
                valueLabel={channelValue}
                title={_('Channel')}
                emptyLabel={_('No channels or DMs found.')}
                clearLabel={_('Any channel')}
                onClear={filters.channel_id ? () => onChannelChange('*all') : undefined}
            >
                {(search, close) => (
                    <ChannelFilterRows
                        channels={channels}
                        dmChannels={dmChannels}
                        users={users}
                        value={filters.channel_id || ''}
                        search={search}
                        onSelect={(name) => { onChannelChange(name); close() }}
                    />
                )}
            </DrillIn>

            {showFileTypeFilter && (
                <ChipSection title={_('Type')}>
                    {FILE_TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon
                        const selected = fileTypes.includes(option.id)
                        return (
                            <Chip
                                key={option.id}
                                selected={selected}
                                onClick={() => toggle(fileTypes, option.id, onFileTypeChange)}
                            >
                                <Icon className={cn('size-4', selected ? 'text-ink-gray-8' : 'text-ink-gray-4')} />
                                {_(option.label)}
                            </Chip>
                        )
                    })}
                </ChipSection>
            )}

            {showProviderFilter &&
                PROVIDER_CATEGORIES.map((category) => (
                    <ChipSection key={category.label} title={_(category.label)}>
                        {category.options.map((option) => {
                            const Icon = option.icon
                            const selected = providers.includes(option.id)
                            return (
                                <Chip
                                    key={option.id}
                                    selected={selected}
                                    onClick={() => toggle(providers, option.id, onProviderChange)}
                                >
                                    {option.brand ? (
                                        <BrandIcon brand={option.brand} className="size-4 shrink-0" />
                                    ) : Icon ? (
                                        <Icon className={cn('size-4', selected ? 'text-ink-gray-8' : 'text-ink-gray-6')} />
                                    ) : null}
                                    {_(option.label)}
                                </Chip>
                            )
                        })}
                    </ChipSection>
                ))}

            {/* The badge row that normally offers "clear all" is behind this
                sheet — it needs its own way out. */}
            {anyActive && (
                <div className='px-4 pt-4'>
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={clearAll}
                        className="w-full"
                    >
                        {_('Clear all filters')}
                    </Button>
                </div>
            )}
        </div>
    )
}

/**
 * A row that pushes a nested drawer holding a searchable list — vaul
 * stacks it over this sheet, iOS-style. Tall on purpose: the search
 * keyboard needs the room, and a short sheet under a keyboard is
 * unusable. The drawer unmounts on close, so search state resets itself.
 */
const DrillIn = ({
    label,
    valueLabel,
    title,
    emptyLabel,
    clearLabel,
    onClear,
    children,
}: {
    label: string
    /** The current selection, avatar/icon included — not just its name. */
    valueLabel?: ReactNode
    title: string
    emptyLabel: string
    /** The clear row's wording ("Anyone", "Any channel"). */
    clearLabel: string
    /** Pass only while something IS selected — its presence shows the
     *  clear row. The desktop combobox clears from its trigger; a sheet
     *  needs a row. */
    onClear?: () => void
    children: (search: string, close: () => void) => ReactNode
}) => {
    const [open, setOpen] = useState(false)
    // Selecting a row must close through vaul's OWN path. Flipping the
    // controlled prop skips vaul's closeDrawer(), and closeDrawer is what
    // tells the PARENT sheet to un-scale — a programmatic close left it
    // shrunken. Clicking this hidden Radix close goes through it, same as
    // a drag or overlay dismiss.
    const closeRef = useRef<HTMLButtonElement>(null)
    const [search, setSearch] = useState('')
    // Seeded to a value no row matches, so nothing looks pre-chosen on
    // open — same trick as FilterCombobox.
    const [highlighted, setHighlighted] = useState('__no-selection__')

    const onOpenChange = (next: boolean) => {
        setOpen(next)
        if (next) {
            // Reset the cmdk highlight on OPEN, same as FilterCombobox:
            // picking a row sets cmdk's selection to it, and this state
            // outlives the drawer content (it lives here, in DrillIn). A
            // reopen would otherwise paint the previously picked row as
            // selected — even after the filter was cleared.
            setHighlighted('__no-selection__')
        } else {
            setSearch('')
        }
    }

    return (
        <DrawerNested open={open} onOpenChange={onOpenChange}>
            <DrawerTrigger asChild>
                <button
                    type="button"
                    className="flex w-full shrink-0 cursor-pointer items-center gap-2 p-3 px-4 rounded-md text-left active:bg-surface-gray-1"
                >
                    <span className="text-base text-ink-gray-7">{label}</span>
                    {/* A flex container, not a text span: the value can carry an
                        avatar or channel icon. Inner nodes own their truncation. */}
                    <span className={cn('flex min-w-0 flex-1 items-center justify-end text-base', valueLabel ? 'text-ink-gray-9' : 'text-ink-gray-6')}>
                        {valueLabel ?? _('Any')}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-ink-gray-5" />
                </button>
            </DrawerTrigger>
            <DrawerContent
                className="h-[85dvh]"
                // Radix focuses the first tabbable on open — the search field,
                // which throws the keyboard over the list before it can even
                // be seen. Tapping the field still opens it.
                onOpenAutoFocus={(event) => event.preventDefault()}
            >
                <DrawerTitle className="px-4 py-2 text-left text-2xl-semibold text-ink-gray-9">
                    {title}
                </DrawerTitle>
<DrawerDescription className="sr-only">{_("Search and pick an option to filter results")}</DrawerDescription>
                {/* Hidden — the close() handed to rows clicks it. See closeRef. */}
                <DrawerClose ref={closeRef} className="hidden" tabIndex={-1} aria-hidden />
                <Command
                    shouldFilter
                    filter={scoreFilterRow}
                    value={highlighted}
                    onValueChange={setHighlighted}
                    className="min-h-0 flex-1 bg-transparent"
                >
                    {/* The standard input, styled like every other search field
                        in the app. cmdk only takes its search through its own
                        input component, so a visually-hidden one below mirrors
                        this field's value into the filter store. */}
                    <div className="shrink-0 px-4 py-2">
                        <InputGroup size="lg">
                            <InputGroupAddon>
                                <SearchIcon className="pointer-events-none h-4 w-4 text-ink-gray-4" />
                            </InputGroupAddon>
                            <Input
                                value={search}
                                inputSize={"lg"}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={_('Search')}
                            />
                        </InputGroup>
                    </div>
                    <CommandPrimitive.Input
                        value={search}
                        onValueChange={setSearch}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden
                    />
                    {/* The way back to unfiltered, shown only while something
                        is picked. Outside the cmdk list so a search cannot
                        filter it away. */}
                    {onClear && (
                        <div className="shrink-0 px-2">
                            <button
                                type="button"
                                onClick={() => { onClear(); closeRef.current?.click() }}
                                className="flex h-11 w-full cursor-pointer items-center gap-2 rounded px-2 text-lg text-ink-gray-7 active:bg-surface-gray-2"
                            >
                                <XIcon className="size-4 shrink-0 text-ink-gray-5" />
                                {clearLabel}
                            </button>
                        </div>
                    )}
                    {/* The rows come from the shared filter lists, sized for a
                        desktop menu (30px). A thumb needs more: 44px rows and
                        roomier headings, applied here so the desktop combobox
                        keeps its density. Heading type is the menu-label look
                        (13px medium gray-4), pinned in full since CommandGroup's
                        default is now the command PALETTE's (body-size regular
                        gray-5). Same recipe as FilterCombobox: real utilities,
                        never espresso's .text-sm-medium (a @layer components
                        class — behind a [&_…] variant it compiles to nothing,
                        which is exactly how the old override here was a silent
                        no-op), and routed through [cmdk-group] so they beat the
                        base heading utilities on specificity instead of tying
                        and leaving the winner to Tailwind's generated order. */}
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 [&_[cmdk-item]]:h-10 [&_[cmdk-group]_[cmdk-group-heading]]:text-sm [&_[cmdk-group]_[cmdk-group-heading]]:font-medium [&_[cmdk-group]_[cmdk-group-heading]]:text-ink-gray-4 [&_[cmdk-group]_[cmdk-group-heading]]:flex [&_[cmdk-group]_[cmdk-group-heading]]:h-9 [&_[cmdk-group]_[cmdk-group-heading]]:items-center [&_[cmdk-group]_[cmdk-group-heading]]:py-0">
                        <CommandList className="max-h-none overflow-visible">
                            <CommandEmpty>{emptyLabel}</CommandEmpty>
                            {children(search, () => closeRef.current?.click())}
                        </CommandList>
                    </div>
                </Command>
            </DrawerContent>
        </DrawerNested>
    )
}

const ChipSection = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="flex shrink-0 flex-col gap-3 pt-4 px-4">
        <div className="text-base text-ink-gray-7">{title}</div>
        <div className="flex flex-wrap gap-2">{children}</div>
    </div>
)

const Chip = ({
    selected,
    onClick,
    children,
}: {
    selected: boolean
    onClick: () => void
    children: ReactNode
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
            'flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-base',
            selected
                ? 'border-outline-gray-8 bg-surface-gray-2 text-ink-gray-9'
                : 'border-outline-gray-3 text-ink-gray-6 active:bg-surface-gray-1',
        )}
    >
        {children}
    </button>
)
