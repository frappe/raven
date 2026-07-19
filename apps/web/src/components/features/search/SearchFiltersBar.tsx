import { useEffect } from 'react'
import { ChannelSelect } from '@components/common/ChannelSelect/ChannelSelect'
import { UserFilter } from './UserFilter'
import { useClearSearchFilters } from './useClearSearchFilters'
import { SearchFiltersPopoverContent } from './SearchFiltersPopover'
import { Popover, PopoverTrigger } from '@components/ui/popover'
import { ListFilter, X } from 'lucide-react'
import { SearchFilters as SearchFiltersType } from './types'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import _ from '@lib/translate'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@db'
import { useChannelMembers } from '@hooks/useChannelMembers'
import { Badge } from '@components/ui/badge'

interface SearchFiltersProps {
    filters: SearchFiltersType
    channels: ChannelListItem[]
    dmChannels: DMChannelListItem[]
    onChannelChange: (value: string) => void
    onUserChange: (value: string) => void
    isMobile?: boolean
}
export function SearchFiltersBar({ filters, channels, dmChannels, isMobile, onChannelChange, onUserChange }: SearchFiltersProps) {
    const users = useLiveQuery(() => db.users.toArray(), [])
    const { members, isLoading: isMembersLoading } = useChannelMembers(filters.channel_id || '')
    const clearAll = useClearSearchFilters()

    const userFilterOptions = filters.channel_id && members.length > 0 ? members : (users ?? [])

    // Ensure that if a channel is selected and a user is selected, the user must be a member of the channel, else clear the filter.
    useEffect(() => {
        if (!filters.channel_id) return
        if (!filters.owner || filters.owner === 'all') return
        if (isMembersLoading) return
        if (members.some(m => m.name === filters.owner)) return
        onUserChange('')
    }, [filters.channel_id, filters.owner, members, isMembersLoading, onUserChange])

    const moreFiltersCount = [
        filters.file_type && filters.file_type.length > 0,
        filters.channel_type !== '',
        filters.is_direct_message === 1,
        filters.is_thread_message === 1,
        filters.is_pinned === 1,
        filters.saved === 1,
        filters.has_reactions === 1,
        filters.mentions_me === 1,
    ].filter(Boolean).length

    const hasFilters = filters.channel_id !== '' || filters.owner !== '' || moreFiltersCount > 0

    return (
        <div className="flex flex-row items-center gap-2 md:flex-nowrap">
            {/* Each select fills its wrapper (trigger w-full + truncates); the wrapper does
                the sizing. Mobile: flex-1 shares the row. Desktop: fixed width with a
                min-width floor — when the clear-all X appears the selects give up a little
                width to absorb it, so no horizontal scroll on normal screens. Below the
                floors the row's overflow-x-auto (see Search.tsx) takes over as fallback.
                (width, not flex-basis: a basis is ignored in the parent's max-content
                sizing, which collapsed the selects to their text width by default.) */}
            <div className="flex-1 min-w-0 md:flex-initial md:w-[8.5rem] md:min-w-[7rem]">
                <UserFilter
                    filters={filters}
                    users={userFilterOptions}
                    onValueChange={(value) => onUserChange?.(value)}
                    showLabel={false}
                    size="sm"
                    dropdownClassName="w-60"
                    triggerClassName="w-full"
                    className="w-full min-w-0"
                />
            </div>
            <div className="flex-1 min-w-0 md:flex-initial md:w-40 md:min-w-[8.5rem]">
                <ChannelSelect
                    channels={channels}
                    dmChannels={dmChannels}
                    users={users}
                    value={filters.channel_id || ""}
                    onValueChange={(value) => onChannelChange?.(value)}
                    placeholder="In"
                    allowAll
                    allLabel={_("In Any Channel")}
                    size="sm"
                    dropdownClassName="w-68"
                    triggerClassName="w-full"
                    className="w-full min-w-0"
                    showLabel={false}
                    label="Channel"
                    searchable
                />
            </div>
            {/* TODO: Add date range filter capability to sqlite search, either Frappe side or override in Raven */}

            {/* Compact icon Filters button — segmented with a clear-all X when any filter
                is active. The floating count badge overhangs the top-right corner. */}
            <Popover>
                <div className="shrink-0 inline-flex h-8 sm:h-7 items-stretch rounded border border-outline-gray-2 bg-surface-base divide-x divide-outline-gray-2">
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            aria-label={_("Filters")}
                            className="relative flex items-center justify-center px-2 rounded-l-[3px] text-ink-gray-7 hover:bg-surface-gray-2 active:bg-surface-gray-3 transition-colors"
                        >
                            <ListFilter className="h-4 w-4" />
                            {moreFiltersCount > 0 && (
                                <Badge
                                    variant="solid"
                                    theme="gray"
                                    size="sm"
                                    className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-2xs"
                                >
                                    {moreFiltersCount}
                                </Badge>
                            )}
                        </button>
                    </PopoverTrigger>
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={clearAll}
                            aria-label={_("Clear All")}
                            className="flex items-center justify-center px-2 rounded-r-[3px] text-ink-gray-7 hover:bg-surface-gray-2 active:bg-surface-gray-3 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <SearchFiltersPopoverContent filters={filters} />
            </Popover>
        </div>
    )
}
