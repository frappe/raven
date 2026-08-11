import { ExternalLink, LinkIcon } from 'lucide-react'
import _ from '@lib/translate'
import { LinkSearchResult } from '@hooks/useLinkSearch'
import { SearchHighlightedText } from '@components/features/message/renderers/SearchTextRenderer'
import { BRAND, BrandIcon, PROVIDER_BRAND, type BrandSpec } from '@components/features/message/renderers/BrandIcons'
import { matchFrappeMeet, matchGoogleMeet, matchZoom } from '@components/features/message/renderers/LinkPreview'
import { cn } from '@lib/utils'

/**
 * The link itself, as one block: image or brand tile, title, source line,
 * description — with tailored rows for meeting links. Shared by the
 * search Links tab and the channel settings drawer's links tab, so the
 * two surfaces present a link identically. The surrounding row (who
 * shared it, where, when, click behaviour) belongs to the caller.
 *
 * Mobile stacks text over a full-width banner; desktop puts a landscape
 * thumbnail beside the text.
 */

/**
 * Meeting links never get fetched previews (nothing to scrape — the page
 * is a lobby), so their rows are tailored: brand tile, meeting kind, and
 * the meeting's human identity (number / room / code) parsed from the URL
 * by the same matchers the chat embeds use.
 */
const MEETING_ROWS: Record<string, { brand: BrandSpec; label: string; match: (href: string) => { detail: string } | null }> = {
    'Frappe Meet': { brand: BRAND.frappeMeet, label: 'Frappe Meet', match: matchFrappeMeet },
    'Google Meet': { brand: BRAND.googleMeet, label: 'Google Meet', match: matchGoogleMeet },
    'Zoom': { brand: BRAND.zoom, label: 'Zoom meeting', match: matchZoom },
}

export const LinkResultContent = ({ link, compact = false }: {
    link: LinkSearchResult
    /**
     * For narrow hosts (the channel settings drawer): a small fixed thumb
     * beside the text at every breakpoint, no full-width banners — the
     * host has no width to spend.
     */
    compact?: boolean
}) => {
    const url = link.url
    const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
    const meeting = MEETING_ROWS[link.provider ?? '']
    // No favicon service (it leaked every reader's result list to a third
    // party). Known providers show their brand glyph; the rest a plain box.
    const brand = PROVIDER_BRAND[link.provider ?? '']

    const openExternal = (e: React.MouseEvent) => {
        e.stopPropagation()
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    if (meeting) {
        return (
            <div className="flex items-center gap-3">
                {/* Smaller tile on a phone — the glyph carries the same
                    information at any size, and width is scarce. */}
                <div className={cn(
                    "flex shrink-0 items-center justify-center rounded-md border border-outline-gray-2 bg-surface-gray-1",
                    compact ? "h-14 w-24" : "h-16 w-28 md:h-24 md:w-42",
                )}>
                    <BrandIcon brand={meeting.brand} className={compact ? "size-6" : "size-7 md:size-8"} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-p-base-medium text-ink-gray-8">{_(meeting.label)}</h3>
                        <ExternalLink
                            className="h-3 w-3 shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink-gray-8"
                            onClick={openExternal}
                        />
                    </div>
                    {/* The meeting's identity — a formatted number, a room, a
                        code — or the host when the URL shape is unknown. */}
                    <div className="mt-1 truncate text-sm text-ink-gray-5">
                        {meeting.match(url)?.detail ?? hostname}
                    </div>
                </div>
            </div>
        )
    }

    return (
        // Mobile stacks: text first (you scan titles, not pictures), then
        // the image as a full-width banner. Desktop keeps the side
        // thumbnail — the pane is wide enough for both at once. Compact
        // hosts always use a small side thumb.
        <div className={cn(compact ? "flex gap-3" : "flex flex-col md:flex-row gap-2 md:gap-3")}>
            {/* Landscape, like the og banners it crops (1200×630 is the
                standard) — a square crop wasted most of them. No image
                (or a dead one): the provider's brand glyph, or a plain
                box. On mobile and in compact hosts an image-less row shows
                NO box at all — the glyph already sits in the site line,
                and an empty box would spend the very space these layouts
                save. */}
            <div className={cn(
                "relative rounded-md bg-surface-gray-2 shrink-0 border border-outline-gray-2 overflow-hidden items-center justify-center",
                compact
                    ? cn("h-14 w-24", link.image ? "flex" : "hidden")
                    : cn(
                        "order-2 md:order-1 h-32 w-full md:h-24 md:w-42",
                        link.image ? "flex" : "hidden md:flex",
                    ),
            )}>
                {brand ? (
                    <BrandIcon brand={brand} className={compact ? "size-6" : "size-8"} />
                ) : (
                    <LinkIcon className={cn(compact ? "size-6" : "size-8", "text-ink-gray-4")} />
                )}
                {link.image && (
                    <img
                        src={link.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                )}
            </div>
            <div className={cn("flex-1 min-w-0", !compact && "order-1 md:order-2")}>
                <div className="flex items-center gap-1.5">
                    {/* Same FTS snippet treatment as the file rows: the title
                        can arrive with <mark> around matched terms. */}
                    <h3 className="text-p-base-medium text-ink-gray-8 truncate">
                        {link.title ? <SearchHighlightedText content={link.title} /> : url}
                    </h3>
                    <ExternalLink
                        className="h-3 w-3 text-ink-gray-4 opacity-0 group-hover:opacity-100 hover:text-ink-gray-8 transition-opacity shrink-0"
                        onClick={openExternal}
                    />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-ink-gray-5 mt-1">
                    {brand && <BrandIcon brand={brand} className="size-3.5 shrink-0" />}
                    <span className="truncate">{link.site_name || hostname}</span>
                </div>
                {link.description && (
                    <p className="text-p-sm text-ink-gray-6 mt-1 line-clamp-2" title={link.description}>{link.description}</p>
                )}
            </div>
        </div>
    )
}
