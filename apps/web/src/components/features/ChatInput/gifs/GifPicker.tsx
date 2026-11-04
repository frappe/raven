import { useEffect, useRef } from "react"
import { SearchIcon } from "lucide-react"
import { VirtuosoMasonry, type ItemContent } from "@virtuoso.dev/masonry"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { InputGroup, InputGroupAddon } from "@components/ui/input-group"
import { Skeleton } from "@components/ui/skeleton"
import { useIsMobile } from "@hooks/use-mobile"
import { pickPreview, type KlipyGif } from "@lib/klipy"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { useGifSearch } from "./useGifSearch"

type GifTileContext = { onPick: (gif: KlipyGif, query: string) => void; query: string; count: number; loadMore: () => void }

/** Two skeleton columns of uneven heights, so loading looks like the grid it becomes. */
const SKELETON_COLUMNS = [[120, 88, 140, 100], [96, 132, 84, 120]]

/** The tile's box from KLIPY's size, so the masonry measures it before the GIF loads. */
const aspectRatio = (width: number, height: number) => (width > 0 && height > 0 ? `${width} / ${height}` : "1 / 1")

const GifTile: ItemContent<KlipyGif, GifTileContext> = ({ data: gif, index, context }) => {
    const { onPick, query, count, loadMore } = context
    // The masonry has no end-reached callback; rendering the last tile stands in for it.
    const isLast = index === count - 1
    useEffect(() => {
        if (isLast) loadMore()
    }, [isLast, loadMore])

    const media = pickPreview(gif)
    if (!media) return null
    return (
        // Padding, not a column gap: it keeps the focus ring inside the scroller's clip.
        <div className="p-0.75">
            <button
                type="button"
                aria-label={gif.title || _("GIF")}
                onClick={() => onPick(gif, query)}
                className="block w-full overflow-hidden rounded-md bg-surface-gray-2 outline-none focus-visible:focus-ring motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.96]"
                style={{ aspectRatio: aspectRatio(media.width, media.height) }}
            >
                <img src={media.url} alt="" decoding="async" draggable={false} className="size-full object-cover" />
            </button>
        </div>
    )
}

const GifGridSkeleton = () => (
    <div className="flex gap-1.5 p-0.75">
        {SKELETON_COLUMNS.map((heights, column) => (
            <div key={column} className="flex flex-1 flex-col gap-1.5">
                {heights.map((height, row) => <Skeleton key={row} style={{ height }} />)}
            </div>
        ))}
    </div>
)

/** The text is hidden from screen readers; the picker's status region reads it out. */
const GifNotice = ({ text, onRetry, className }: { text: string; onRetry?: () => void; className?: string }) => (
    <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
        <p aria-hidden="true" className="text-p-base text-ink-gray-5">{text}</p>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{_("Try again")}</Button>}
    </div>
)

/** Search + 2-column masonry of KLIPY GIFs, trending until the user types. Results stay in KLIPY's order. */
export const GifPicker = ({ onPick, className }: { onPick: (gif: KlipyGif, query: string) => void; className?: string }) => {
    const isMobile = useIsMobile()
    const { state, setQuery, loadMore, retry } = useGifSearch()
    // Tiles stay clickable while the popover or sheet animates closed: a double-click would
    // send twice. Each open mounts a new picker, so one pick per picker is one per open.
    const picked = useRef(false)
    const pick = (gif: KlipyGif, query: string) => {
        if (picked.current) return
        picked.current = true
        onPick(gif, query)
    }

    const failed = state.status === "error"
    const errorText = state.rateLimited
        ? _("Too many GIF searches. Try again in a few minutes.")
        : _("Unable to load GIFs. Check your connection and try again.")
    const emptyText = state.query ? _("No GIFs for “{0}”", [state.query]) : _("No GIFs found")
    const statusText = failed ? errorText : state.status === "idle" && !state.items.length ? emptyText : ""

    let body
    if (state.items.length) {
        body = (
            <VirtuosoMasonry
                columnCount={2}
                data={state.items}
                context={{ onPick: pick, query: state.query, count: state.items.length, loadMore }}
                ItemContent={GifTile}
                className="overscroll-contain"
                style={{ height: "100%" }}
            />
        )
    } else if (state.status === "loading") {
        body = <GifGridSkeleton />
    } else {
        body = <GifNotice text={failed ? errorText : emptyText} onRetry={failed ? retry : undefined} className="py-10" />
    }

    return (
        <div className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
            <InputGroup variant="subtle">
                <InputGroupAddon><SearchIcon /></InputGroupAddon>
                <Input
                    type="search"
                    enterKeyHint="search"
                    placeholder={_("Search KLIPY")}
                    aria-label={_("Search KLIPY")}
                    autoFocus={!isMobile}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </InputGroup>
            <div className="min-h-0 flex-1 overflow-hidden">{body}</div>
            {/* A page that failed after earlier ones keeps the grid; say why it stopped. */}
            {failed && state.items.length > 0 && <GifNotice text={errorText} onRetry={retry} />}
            <p role="status" className="sr-only">{statusText}</p>
            <p className="text-center text-xs text-ink-gray-5">{_("Powered by KLIPY")}</p>
        </div>
    )
}
