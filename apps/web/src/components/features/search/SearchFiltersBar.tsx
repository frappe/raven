import { useEffect } from 'react'
import { ChannelFilter } from '@components/common/filters/ChannelFilter'
import { UserFilter } from '@components/common/filters/UserFilter'
import { FileTypeFilter } from '@components/common/filters/FileTypeFilter'
import { ProviderFilter } from '@components/common/filters/ProviderFilter'
import { SearchFilters as SearchFiltersType } from './types'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import _ from '@lib/translate'
import { useUsers } from '@hooks/useUsers'
import { useChannelMembers } from '@hooks/useChannelMembers'

/**
 * min-w-0 lets a filter shrink past its content, which is what keeps a long channel name
 * truncating inside its trigger instead of widening its column at the others' expense.
 */
const FILTER_WIDTH = "min-w-0"

interface SearchFiltersProps {
    filters: SearchFiltersType
    channels: ChannelListItem[]
    dmChannels: DMChannelListItem[]
    onChannelChange: (value: string) => void
    onUserChange: (value: string) => void
    onFileTypeChange: (value: string[]) => void
    onProviderChange: (value: string[]) => void
    /** File type only narrows file results — the other tabs have no use for it. */
    showFileTypeFilter?: boolean
    /** Provider only narrows link results — shown on the links tab. */
    showProviderFilter?: boolean
}
export function SearchFiltersBar({ filters, channels, dmChannels, onChannelChange, onUserChange, onFileTypeChange, onProviderChange, showFileTypeFilter, showProviderFilter }: SearchFiltersProps) {
    const users = useUsers()
    const { members, isLoading: isMembersLoading } = useChannelMembers(filters.channel_id || '')

    const userFilterOptions = filters.channel_id && members.length > 0 ? members : users

    // Ensure that if a channel is selected and a user is selected, the user must be a member of the channel, else clear the filter.
    useEffect(() => {
        if (!filters.channel_id) return
        if (!filters.owner || filters.owner === 'all') return
        if (isMembersLoading) return
        if (members.some(m => m.name === filters.owner)) return
        onUserChange('')
    }, [filters.channel_id, filters.owner, members, isMembersLoading, onUserChange])

    return (
        // A vertical stack: this lives inside the filter POPOVER now, not a
        // page row. Full-width triggers, one control per line, each with a
        // label — the triggers' placeholders can then say the neutral value
        // ("Anyone") instead of repeating the field's name. Clearing
        // everything at once lives with the active-filter badges on the
        // page, which is the line that already says what's on.
        <div className="flex flex-col gap-3">
            {/* Each filter fills the popover's width; their own dropdowns are
                collision-padded, so nesting popovers costs no readability. */}
            <Field label={_("Person")}>
                <UserFilter
                    users={userFilterOptions}
                    value={filters.owner || ''}
                    onValueChange={onUserChange}
                    placeholder={_("Anyone")}
                    triggerClassName="w-full"
                    className="w-full min-w-0"
                />
            </Field>
            <Field label={_("Channel")}>
                <ChannelFilter
                    channels={channels}
                    dmChannels={dmChannels}
                    users={users}
                    value={filters.channel_id || ""}
                    onValueChange={onChannelChange}
                    allLabel={_("Any channel")}
                    triggerClassName="w-full"
                    className="w-full min-w-0"
                />
            </Field>
            {/* Tab-scoped: leaving the files tab clears this selection
                (see onTabChange) — its badge lingering on other tabs read
                like a filter that wasn't filtering. */}
            {showFileTypeFilter && (
                <Field label={_("File type")}>
                    <FileTypeFilter
                        value={filters.file_type || []}
                        onValueChange={onFileTypeChange}
                        placeholder={_("Any type")}
                        triggerClassName="w-full"
                        className="w-full min-w-0"
                    />
                </Field>
            )}
            {/* The links tab's counterpart to file type. */}
            {showProviderFilter && (
                <Field label={_("Source")}>
                    <ProviderFilter
                        value={filters.link_provider || []}
                        onValueChange={onProviderChange}
                        placeholder={_("Any source")}
                        triggerClassName="w-full"
                        className="w-full min-w-0"
                    />
                </Field>
            )}
            {/* TODO: Add date range filter capability to sqlite search, either Frappe side or override in Raven */}
        </div>
    )
}

/** A labelled field in the popover stack. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className={`flex flex-col gap-1 ${FILTER_WIDTH}`}>
            <span className="text-sm text-ink-gray-6">{label}</span>
            {children}
        </div>
    )
}
