import type { ReactNode } from 'react'
import { FileIcon, GlobeIcon, X } from 'lucide-react'
import { Badge } from '@components/ui/badge'
import { SearchFilters } from './types'
import { useClearSearchFilters } from './useClearSearchFilters'
import { formatFileTypeNames } from '@components/common/filters/FileTypeFilter'
import { ALL_PROVIDER_OPTIONS } from '@components/common/filters/ProviderFilter'
import { BrandIcon } from '@components/features/message/renderers/BrandIcons'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { UserData } from "@db"
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@lib/utils'
import _ from '@lib/translate'

/** Names shown on a multi-select badge before the tail becomes "and N more". */
const MAX_NAMED_IN_BADGE = 3

/** Glyphs shown on the Source badge before the rest collapse into "+N". */
const MAX_BADGE_GLYPHS = 6

/**
 * The Source badge shows an avatar-group of provider glyphs instead of
 * names — the marks are more recognisable than the words. Bare glyphs are
 * transparent shapes and would overlap into mush, so each sits on a small
 * circle (background only — the contrast against the badge's gray is
 * separation enough), and the CIRCLES overlap like avatars do.
 */
const ProviderGlyphGroup = ({ ids }: { ids: string[] }) => {
    const options = ALL_PROVIDER_OPTIONS.filter((option) => ids.includes(option.id))
    const shown = options.slice(0, MAX_BADGE_GLYPHS)
    const extra = options.length - shown.length

    return (
        <span className="flex items-center gap-1.5">
            <GlobeIcon className="size-4 shrink-0 text-ink-gray-6" />
            <span className="flex gap-1">
                {shown.map((option) => {
                    const Icon = option.icon
                    return (
                        <span
                            key={option.id}
                            title={_(option.label)}
                            className="flex size-6 items-center justify-center rounded-full bg-surface-base"
                        >
                            {option.brand ? (
                                <BrandIcon brand={option.brand} className="size-4" />
                            ) : Icon ? (
                                <Icon className="size-4 text-ink-gray-6" />
                            ) : null}
                        </span>
                    )
                })}
                {extra > 0 && (
                    <span className="flex size-6 items-center justify-center rounded-full bg-surface-gray-4 text-xs leading-none text-ink-gray-7">
                        +{extra}
                    </span>
                )}
            </span>
        </span>
    )
}

interface FilterBadgeProps {
    /** Stable list identity — labels can be rich nodes now, not just strings. */
    id: string
    label: ReactNode
    onRemove: () => void
    /** Per-badge overrides — the glyph badge needs more height than lg's h-6. */
    className?: string
}

function FilterBadge({ label, onRemove, className }: FilterBadgeProps) {
    return (
        <Badge
            variant="subtle"
            size="lg"
            theme="gray"
            // h-auto with a shared floor: contents differ in height (glyph
            // circles are 24px, avatars less, plain text least), so without
            // the min-h each pill would size to its own content and the row
            // would sit at three different heights. 32px fits the tallest.
            className={cn("cursor-pointer mb-2 h-auto min-h-8 py-1", className)}
            onClick={onRemove}>
            {label}
            <X />
        </Badge>
    )
}

export function SearchActiveBadges({ filters, channels, dmChannels, users }: { filters: SearchFilters, channels: ChannelListItem[], dmChannels: DMChannelListItem[], users: UserData[] }) {

    const [, setSearchParams] = useSearchParams()
    const clearAll = useClearSearchFilters()

    if (!filters) return null

    const removeParam = (key: string) => () => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev)
            params.delete(key)
            return params
        }, { replace: true })
    }

    // Built as a list rather than inline conditionals so the row knows how many badges
    // it has — "Clear all" is only worth showing once there's more than one to clear.
    const badges: FilterBadgeProps[] = []

    // User and channel show the person/channel as they look everywhere
    // else — avatar and channel icon, not a bare name.
    if (filters.owner) {
        const owner = users.find(u => u.name === filters.owner)
        badges.push({
            id: 'user',
            label: (
                <span className="flex items-center gap-1.5">
                    {owner && <UserAvatar user={owner} size="xs" showStatusIndicator={false} showBotIndicator={false} />}
                    <span className="max-w-40 truncate">{owner?.full_name ?? filters.owner}</span>
                </span>
            ),
            onRemove: removeParam('user'),
        })
    }

    if (filters.channel_id) {
        const channel = channels.find(c => c.name === filters.channel_id)
        const dm = dmChannels.find(dc => dc.name === filters.channel_id)
        const dmPeer = dm ? users.find(u => u.name === dm.peer_user_id) : undefined
        badges.push({
            id: 'channel',
            label: (
                <span className="flex items-center gap-1.5">
                    {channel && <ChannelIcon type={channel.type} className="size-3.5 shrink-0 text-ink-gray-5" />}
                    {dmPeer && <UserAvatar user={dmPeer} size="xs" showStatusIndicator={false} showBotIndicator={false} />}
                    <span className="max-w-40 truncate">
                        {channel?.channel_name ?? dmPeer?.full_name ?? dm?.peer_user_id ?? filters.channel_id}
                    </span>
                </span>
            ),
            onRemove: removeParam('channel'),
        })
    }

    // Names beat counts ("File PDFs, Images" says more than "File: 2
    // types") — but only up to three: past that the pill becomes a
    // paragraph, so the tail collapses to "and N more". Same prefix-word
    // shape as the other badges, no colon.
    if (filters.file_type && filters.file_type.length > 0) badges.push({
        id: 'file_type',
        label: (
            <span className="flex items-center gap-1.5">
                <FileIcon className="size-4 shrink-0 text-ink-gray-6" />
                <span className="max-w-40 truncate">
                    {formatFileTypeNames(filters.file_type, MAX_NAMED_IN_BADGE)}
                </span>
            </span>
        ),
        onRemove: removeParam('file_type'),
    })

    // Sources show their glyphs, not their names — see ProviderGlyphGroup.
    if (filters.link_provider && filters.link_provider.length > 0) badges.push({
        id: 'link_provider',
        label: <ProviderGlyphGroup ids={filters.link_provider} />,
        onRemove: removeParam('link_provider'),
    })

    if (badges.length === 0) return null

    return (
        <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
                <FilterBadge key={badge.id} {...badge} />
            ))}
        </div>
    )
}
