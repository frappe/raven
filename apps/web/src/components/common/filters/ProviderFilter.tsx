import { ChevronDownIcon, Globe2Icon, LaptopIcon, ListFilterIcon, XIcon, type LucideIcon } from 'lucide-react';
import { Checkbox } from '@components/ui/checkbox';
import { Button } from '@components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { FILTER_DROPDOWN_WIDTH, FILTER_ITEM_STYLES, FILTER_TRIGGER_STYLES, PAGE_GUTTER } from './FilterCombobox';
import { BRAND, BrandIcon, type BrandSpec } from '@components/features/message/renderers/BrandIcons';
import { useCallback, useState } from 'react';
import { useIsMobile } from '@hooks/use-mobile';
import { cn } from '@lib/utils';
import _ from '@lib/translate';

export type ProviderOption = {
    /** The option id IS the server's provider name (Raven Message Links.provider). */
    id: string
    label: string
    brand?: BrandSpec
    icon?: LucideIcon
}

/**
 * One option per provider, each with its own logo, grouped under category
 * headers. No merged options: filtering YouTube Music apart from YouTube
 * (or one meeting app apart from another) is the point of the filter.
 * Shared with the mobile filter sheet, which renders these as chip groups.
 */
export const PROVIDER_CATEGORIES: Array<{ label: string; options: ProviderOption[] }> = [
    {
        label: 'Media',
        options: [
            { id: 'YouTube', label: 'YouTube', brand: BRAND.youtube },
            { id: 'YouTube Music', label: 'YouTube Music', brand: BRAND.youtubeMusic },
            { id: 'Spotify', label: 'Spotify', brand: BRAND.spotify },
            { id: 'Apple Music', label: 'Apple Music', brand: BRAND.appleMusic },
            { id: 'Apple Podcasts', label: 'Apple Podcasts', brand: BRAND.applePodcasts },
            { id: 'SoundCloud', label: 'SoundCloud', brand: BRAND.soundcloud },
            { id: 'Vimeo', label: 'Vimeo', brand: BRAND.vimeo },
            { id: 'Loom', label: 'Loom', brand: BRAND.loom },
        ],
    },
    {
        label: 'Social',
        options: [
            { id: 'X', label: 'X', brand: BRAND.x },
            { id: 'Reddit', label: 'Reddit', brand: BRAND.reddit },
            { id: 'Hacker News', label: 'Hacker News', brand: BRAND.hackerNews },
        ],
    },
    {
        label: 'Sites',
        options: [
            { id: 'Frappe', label: 'Frappe', brand: BRAND.frappe },
            { id: 'GitHub', label: 'GitHub', brand: BRAND.github },
            { id: 'Figma', label: 'Figma', brand: BRAND.figma },
            { id: 'Wikipedia', label: 'Wikipedia', brand: BRAND.wikipedia },
            { id: 'Other', label: 'Other sites', icon: Globe2Icon },
        ],
    },
    {
        label: 'Meetings',
        options: [
            { id: 'Frappe Meet', label: 'Frappe Meet', brand: BRAND.frappeMeet },
            { id: 'Google Meet', label: 'Google Meet', brand: BRAND.googleMeet },
            { id: 'Zoom', label: 'Zoom', brand: BRAND.zoom },
        ],
    },
    {
        label: 'Workspace',
        options: [
            { id: 'Raven Link', label: 'Raven', brand: BRAND.raven },
            { id: 'Site Document Link', label: 'This site', icon: LaptopIcon },
        ],
    },
]

/** Flat option list — the active-filter badge reads glyphs from here. */
export const ALL_PROVIDER_OPTIONS = PROVIDER_CATEGORIES.flatMap((category) => category.options)

/**
 * Selection as stable, readable names — same rule as formatFileTypeNames.
 * `maxNamed` caps the list: past it the tail becomes "and N more", for
 * surfaces (the badge row) where six names would wrap into a paragraph.
 */
export const formatProviderNames = (ids: string[], maxNamed?: number): string => {
    const names = ALL_PROVIDER_OPTIONS
        .filter((option) => ids.includes(option.id))
        .map((option) => _(option.label))
    if (maxNamed && names.length > maxNamed) {
        return _('{0} and {1} more', [names.slice(0, maxNamed).join(', '), String(names.length - maxNamed)])
    }
    return names.join(', ')
}

const MAX_NAMED_PROVIDERS = 3

interface ProviderFilterProps {
    /** Selected provider names ("YouTube", "Raven Link", …). Multi-select. */
    value: string[]
    onValueChange: (value: string[]) => void
    /** Trigger text while nothing is picked — see UserFilter's placeholder. */
    placeholder?: string
    /**
     * Icon-only trigger with a count dot, for toolbars where a labeled
     * trigger's width changes with the selection and would squeeze its
     * neighbours (the channel drawer's search box).
     */
    iconTrigger?: boolean
    triggerClassName?: string
    className?: string
}

/**
 * Provider picker for the Links search tab. Same shell as FileTypeFilter
 * (multi-select checkbox rows borrowing FilterCombobox's styles), with
 * category headers; the list is long, so it scrolls.
 */
export function ProviderFilter({ value, onValueChange, placeholder, iconTrigger, triggerClassName, className }: ProviderFilterProps) {
    const selected = value
    const checkedCount = selected.length
    const [open, setOpen] = useState(false)
    const isMobile = useIsMobile()

    const toggleProvider = useCallback((id: string) => {
        onValueChange(selected.includes(id)
            ? selected.filter((provider) => provider !== id)
            : [...selected, id])
    }, [selected, onValueChange])

    const triggerLabel = checkedCount === 0
        ? placeholder ?? _('Source')
        : checkedCount <= MAX_NAMED_PROVIDERS
            ? formatProviderNames(selected)
            : _('{0} Sources', [String(checkedCount)])

    return (
        <div className={cn("flex shrink-0", className)}>
            {/* modal on MOBILE only: in the channel drawer's Links tab this popover
                floats over a modal vaul sheet, whose scroll lock preventDefaults
                touchmove everywhere outside the sheet — including this portalled
                list, which therefore never scrolled. A modal popover layers its own
                scroll lock whose allowed region IS the list. Desktop stays
                non-modal so the page behind keeps scrolling. */}
            <Popover open={open} onOpenChange={setOpen} modal={isMobile}>
                <PopoverTrigger asChild>
                    {iconTrigger ? (
                        <Button
                            variant="subtle"
                            size="sm"
                            isIconButton
                            role="combobox"
                            aria-expanded={open}
                            aria-label={_('Filter by source')}
                            className={cn("relative", triggerClassName)}
                        >
                            <ListFilterIcon />
                            {/* Same count dot as the search page's filter button. */}
                            {checkedCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-gray-10 px-1 text-[10px] leading-none text-ink-blue-1">
                                    {checkedCount}
                                </span>
                            )}
                        </Button>
                    ) : (
                        <Button
                            variant="subtle"
                            size="sm"
                            role="combobox"
                            aria-expanded={open}
                            className={cn(FILTER_TRIGGER_STYLES, triggerClassName)}
                        >
                            <span className={cn(
                                "min-w-0 flex-1 truncate text-left leading-snug",
                                checkedCount === 0 && "text-ink-gray-4",
                            )}>
                                {triggerLabel}
                            </span>
                            <ChevronDownIcon className="size-4 shrink-0 text-ink-gray-4" />
                        </Button>
                    )}
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    collisionPadding={PAGE_GUTTER}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    // Twenty-odd rows is too tall for any screen — the list scrolls.
                    className={cn("min-w-(--radix-popover-trigger-width) max-h-80 overflow-y-auto p-1 shadow-2xl", FILTER_DROPDOWN_WIDTH)}
                >
                    {PROVIDER_CATEGORIES.map((category) => (
                        <div key={category.label} className='gap-0.5 flex flex-col'>
                            <div className="px-2 pt-2 text-xs-medium pb-0.5 text-ink-gray-4">
                                {_(category.label)}
                            </div>
                            {category.options.map((option) => {
                                const checked = selected.includes(option.id)
                                const Icon = option.icon
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        // Rows stay open on click — picking several providers
                                        // in one visit is the point of a multi-select.
                                        onClick={() => toggleProvider(option.id)}
                                        className={cn(FILTER_ITEM_STYLES, "w-full", checked && "bg-surface-gray-2 hover:bg-surface-gray-3")}
                                    >
                                        <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                                        {option.brand ? (
                                            <BrandIcon brand={option.brand} className="size-4 shrink-0" />
                                        ) : Icon ? (
                                            <Icon className={cn("size-4 shrink-0", checked ? "text-ink-gray-8" : "text-ink-gray-4")} />
                                        ) : null}
                                        <span className="min-w-0 flex-1 truncate text-left leading-snug">{_(option.label)}</span>
                                    </button>
                                )
                            })}
                        </div>
                    ))}
                    {checkedCount > 0 && (
                        <>
                            <div className="-mx-1 my-1 h-px bg-outline-gray-2" />
                            <button
                                type="button"
                                onClick={() => onValueChange([])}
                                className={cn(FILTER_ITEM_STYLES, "w-full")}
                            >
                                <XIcon className="size-4 shrink-0 text-ink-gray-5" />
                                {_("Clear")}
                            </button>
                        </>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    )
}
