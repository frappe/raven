import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { useAtomValue, useSetAtom } from "jotai"
import { useHotkeys } from "react-hotkeys-hook"
import { useHistoryBackClose } from "@hooks/useHistoryBackClose"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, FileText, Film, Music, MusicIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { MediaLightbox } from "./MediaLightbox"
import { MediaPreviewHeader } from "./MediaPreviewHeader"
import { ZoomableImage } from "./ZoomableImage"
import { SwipeDownToClose } from "./SwipeDownToClose"
import { AudioPlayer } from "./AudioPlayer"
import { useUser } from "@hooks/useUser"
import { useIsMobile } from "@hooks/use-mobile"
import { downloadFile, getFileExtension, shareFile } from "@lib/file"
import { formatBytes } from "@raven/lib/utils/operations"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { attachmentPreviewAtom, type Attachment, type AttachmentPreviewState } from "@utils/attachmentPreview"
import FileTypeIcon from "@components/common/FileIcons/FileTypeIcon"

/** Minimum horizontal travel (px) for a touch swipe to count as paging. */
const SWIPE_THRESHOLD = 50

/** Vertical air between a contained mobile image and the bars (px). */
const CONTAINED_GUTTER = 12

/** How many items before the end of a paginated set to request the next page. */
const NEAR_END_PREFETCH = 5

/**
 * The single, app-wide attachment lightbox. Mounted once at the app shell;
 * any surface opens it by setting `attachmentPreviewAtom`. Pages through a
 * batch of images/PDFs with arrow keys, rendering each by kind.
 *
 * Renders nothing until first opened (one atom read + a ref), and content
 * survives the close animation via a last-state snapshot (the close-flash fix).
 */
export const AttachmentPreviewModal = () => {
    const state = useAtomValue(attachmentPreviewAtom)
    const lastStateRef = useRef<AttachmentPreviewState>(null)
    if (state) lastStateRef.current = state
    const display = state ?? lastStateRef.current

    if (!display) return null

    return <AttachmentPreviewContent display={display} open={state !== null} />
}

const AttachmentPreviewContent = ({
    display,
    open,
}: {
    display: NonNullable<AttachmentPreviewState>
    open: boolean
}) => {
    const setState = useSetAtom(attachmentPreviewAtom)
    const isMobile = useIsMobile()
    const { attachments, index } = display
    const isPreview = display.mode === "preview"
    const current = attachments[index] ?? attachments[0]
    const user = useUser(current.owner)

    // PDFs render inline via <embed> on desktop only — mobile browsers won't,
    // so they fall back to the download card alongside non-previewable files.
    const canEmbedPdf = current.kind === "pdf" && !isMobile

    const close = () => setState(null)

    // Escape is handled by the dialog; arrows page through the set
    const hasMany = attachments.length > 1

    // A "gallery" source (the paginated files tab) supplies onNearEnd. Its
    // strip VIRTUALIZES: tiles load full-res originals (no stored thumbnails
    // yet), so only the visible ones must mount. A plain message keeps the
    // all-rendered centered strip — few images, no perf issue. Chosen by
    // SOURCE, not count, so it never flips mid-session as pages load.
    const galleryStrip = display.onNearEnd != null
    const filmstripVirtuosoRef = useRef<VirtuosoHandle>(null)

    // The lightbox owns the back gesture while open (Android's edge-swipe back
    // was navigating the page UNDER the still-open preview — this modal is
    // atom-driven and route-independent, so it survived the navigation).
    useHistoryBackClose(open, close)

    // Mobile, images only: tapping the photo hides the header + filmstrip +
    // zoom pill (iOS Photos style); tapping again brings them back. Closing
    // still works while hidden — swipe-down and the back gesture. Chrome
    // comes back on reopen and when paging to a non-image (those need their
    // buttons).
    const [chromeHidden, setChromeHidden] = useState(false)
    const toggleChrome = () => setChromeHidden((hidden) => !hidden)
    useEffect(() => {
        if (!open || current.kind !== "image") setChromeHidden(false)
    }, [open, current.kind])

    // Mobile: the media area is inset by the real heights of the two bars, so
    // the image sits BETWEEN them instead of under them (iOS Photos). Hiding
    // the chrome drops the insets and the image expands to the full screen.
    // Measured, not hardcoded — the bars size to their content and rotation.
    const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null)
    const [filmstripEl, setFilmstripEl] = useState<HTMLDivElement | null>(null)
    const [chromeInsets, setChromeInsets] = useState({ top: 0, bottom: 0 })
    // Layout effect, so a (re)opened dialog is measured BEFORE its first paint —
    // measuring after paint made every open start at full height and then
    // animate down to the contained size (visible only on tall images, the
    // height-limited ones). A null element keeps its previous value instead of
    // resetting: the bars unmount while the dialog is closed, and zeroing there
    // queued up the same start-at-full-height slide for the next open. The one
    // real "no bar" case is a single attachment — no filmstrip, bottom = 0.
    useLayoutEffect(() => {
        const measure = () =>
            setChromeInsets((prev) => {
                const top = headerEl ? headerEl.offsetHeight : prev.top
                const bottom = hasMany ? (filmstripEl ? filmstripEl.offsetHeight : prev.bottom) : 0
                // Same numbers → same object, so an unchanged measurement
                // doesn't re-render the modal.
                return top === prev.top && bottom === prev.bottom ? prev : { top, bottom }
            })
        measure()
        const observer = new ResizeObserver(measure)
        if (headerEl) observer.observe(headerEl)
        if (filmstripEl) observer.observe(filmstripEl)
        return () => observer.disconnect()
    }, [headerEl, filmstripEl, hasMany])
    // Wraps at the ends, matching the previous image slideshow behavior —
    // unless the source says more items exist beyond the loaded set
    // (hasMore): then the last loaded item is NOT the real end, so paging
    // clamps there and waits for the source to append the next page.
    const step = (direction: 1 | -1) =>
        setState((prev) => {
            if (!prev) return prev
            const next = prev.index + direction
            if (prev.hasMore) {
                const clamped = Math.min(Math.max(next, 0), prev.attachments.length - 1)
                return clamped === prev.index ? prev : { ...prev, index: clamped }
            }
            return { ...prev, index: (next + prev.attachments.length) % prev.attachments.length }
        })
    const selectIndex = (next: number) => setState((prev) => (prev ? { ...prev, index: next } : prev))

    // Source sync (see AttachmentPreviewState): tell the opener where paging
    // landed so it can keep its list scrolled to the current item, and ask it
    // for the next page while the user is still a few items from the end —
    // by the time they get there, the set has usually already grown.
    // Only PAGING syncs — on open the clicked item is already on screen, and
    // scrolling it (to center) would move the list under the user for nothing.
    const syncedIndexRef = useRef<number | null>(null)
    useEffect(() => {
        if (!open) {
            syncedIndexRef.current = null
            return
        }
        if (syncedIndexRef.current === null) {
            // Just opened — adopt the starting index without scrolling.
            syncedIndexRef.current = index
            return
        }
        if (syncedIndexRef.current === index) return
        syncedIndexRef.current = index
        display.onIndexChange?.(current)
        // display/current are stable for a given index — reacting to index is enough.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, open])
    useEffect(() => {
        if (!open || !display.hasMore) return
        if (index >= attachments.length - NEAR_END_PREFETCH) display.onNearEnd?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, open, attachments.length, display.hasMore])

    // Keep the selected thumbnail centered in the filmstrip: jump to it on
    // open, glide to it while paging. openedRef distinguishes the two — this
    // content stays mounted across closes (close-flash fix), so "on open" is
    // the false→true flip, not mount. Only index CHANGES re-center, so
    // scrubbing the strip by hand isn't fought. The virtualized gallery strip
    // centers via Virtuoso (the active tile may be unmounted); the plain strip
    // scrolls its live element.
    const activeThumbRef = useRef<HTMLDivElement>(null)
    const openedRef = useRef(false)
    useEffect(() => {
        if (!open) {
            openedRef.current = false
            return
        }
        const behavior = openedRef.current ? "smooth" : "auto"
        if (galleryStrip) {
            filmstripVirtuosoRef.current?.scrollToIndex({ index, align: "center", behavior })
        } else {
            activeThumbRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior })
        }
        openedRef.current = true
    }, [index, open, galleryStrip])
    useHotkeys("left", () => step(-1), { enabled: open && hasMany, preventDefault: true }, [open, hasMany])
    useHotkeys("right", () => step(1), { enabled: open && hasMany, preventDefault: true }, [open, hasMany])

    // Touch swipe to page (mobile). Only fires on touch devices, so desktop
    // is unaffected. A child can opt out by stopping touchstart propagation
    // (the audio slider does, so dragging it doesn't get read as a page-swipe).
    const touchStart = useRef<{ x: number; y: number } | null>(null)
    const onTouchStart = (event: React.TouchEvent) => {
        const touch = event.touches[0]
        touchStart.current = { x: touch.clientX, y: touch.clientY }
    }
    const onTouchEnd = (event: React.TouchEvent) => {
        const start = touchStart.current
        touchStart.current = null
        if (!start || !hasMany) return
        const touch = event.changedTouches[0]
        const dx = touch.clientX - start.x
        const dy = touch.clientY - start.y
        // Horizontal-dominant swipe past the threshold = page; ignore vertical
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            step(dx < 0 ? 1 : -1)
        }
    }

    const download = () => downloadFile(current.fileUrl, current.fileName)
    const share = async () => {
        const result = await shareFile(current.fileUrl, current.fileName)
        if (result === "copied") toast.success(_("Link copied"))
        else if (result === "failed") toast.error(_("Could not copy link"))
    }

    // Backdrop fade for the swipe-down-to-close drag: written straight onto the
    // scrim element per pointer move — no state, no re-render, compositor-only.
    // "" restores the class opacity (and the overlay's transition animates it).
    const overlayRef = useRef<HTMLDivElement>(null)
    const onDismissProgress = useCallback((progress: number) => {
        const overlay = overlayRef.current
        if (overlay) overlay.style.opacity = progress === 0 ? "" : String(1 - progress * 0.7)
    }, [])

    return (
        <MediaLightbox open={open} onOpenChange={(next) => !next && close()} title={current.fileName} overlayRef={overlayRef}>
            {/* Chrome bars. On mobile they are absolute so they can fade without
                unmounting; while they show, the media box below shrinks its
                height symmetrically to clear them (see the inner box there).
                Desktop keeps the in-flow row (the PDF embed needs its reserved
                space). */}
            <div ref={setHeaderEl} className={cn(
                "shrink-0 p-3 transition-opacity duration-150 max-md:absolute max-md:inset-x-0 max-md:top-0 max-md:z-20",
                chromeHidden && "pointer-events-none opacity-0",
            )}>
                <MediaPreviewHeader
                    // Preview mode (composer-staged files): no author, no download/share —
                    // just a "Preview" tag. View mode (sent messages): full chrome.
                    user={isPreview ? undefined : (user ?? undefined)}
                    creation={isPreview ? undefined : current.creation}
                    fileName={current.fileName}
                    fileSize={current.size ? formatBytes(current.size) : undefined}
                    badge={isPreview ? <Badge variant="subtle" theme="blue">{_("Preview")}</Badge> : undefined}
                    onDownload={isPreview ? undefined : download}
                    onShare={isPreview ? undefined : share}
                    onClose={close}
                >
                    {hasMany && (
                        // Hidden on mobile: it crowds the action row and wraps to
                        // two lines there, and the filmstrip already shows position.
                        <span className="hidden whitespace-nowrap px-1 text-xs md:inline">
                            {/* "+" = more beyond the loaded set (pages in as you swipe) */}
                            {_("{0} of {1}", [String(index + 1), String(attachments.length) + (display.hasMore ? "+" : "")])}
                        </span>
                    )}
                </MediaPreviewHeader>
            </div>

            {/* The current attachment; clicking the dark backdrop closes.
                p-4 (not px-4) gives a clickable frame on all sides — for the
                PDF <embed>, which fills its box and swallows its own clicks,
                that frame plus the width cap below is the only backdrop */}
            <div
                className="relative flex min-h-0 flex-1 items-center justify-center md:p-4"
                // Clicking the dark area around the media closes — unless this is
                // a mobile image with its chrome hidden, where the whole screen is
                // "the photo" and a tap anywhere brings the chrome back instead.
                // Taps ON a mobile image never reach here — ZoomableImage stops
                // their propagation and reports them via onTap (chrome toggle).
                onClick={isMobile && current.kind === "image" && chromeHidden ? () => setChromeHidden(false) : close}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                {hasMany && !isMobile && (
                    <>
                        {/* Paginated sets clamp at the ends (no wrap), so the
                            chevrons disable there — Next at the last loaded
                            item re-enables the moment the next page lands. */}
                        <Button
                            variant="subtle"
                            size="md"
                            isIconButton
                            disabled={!!display.hasMore && index === 0}
                            onClick={(event) => {
                                event.stopPropagation()
                                step(-1)
                            }}
                            className="absolute left-4 top-1/2 z-10 -translate-y-1/2"
                            title={_("Previous")}
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            variant="subtle"
                            size="md"
                            isIconButton
                            disabled={!!display.hasMore && index === attachments.length - 1}
                            onClick={(event) => {
                                event.stopPropagation()
                                step(1)
                            }}
                            className="absolute right-4 top-1/2 z-10 -translate-y-1/2"
                            title={_("Next")}
                        >
                            <ChevronRight />
                        </Button>
                    </>
                )}

                {/* The iOS containment model: the media stays centered on the TRUE
                    screen always — this inner box shrinks symmetrically (by the
                    taller bar, both sides) while the chrome shows, and grows back
                    to the full screen when it hides. Symmetric is the point: the
                    center never moves, so a wide image (which never touches the
                    height limit anyway) doesn't shift or resize on toggle, and a
                    tall one expands in place. The overshoot in the curve is the
                    subtle iOS bounce. The bottom band exists even without a
                    filmstrip — the reserve is max(header, filmstrip) + gutter. */}
                <div
                    className={cn(
                        "flex h-full min-h-0 w-full items-center justify-center",
                        "max-md:transition-[height] max-md:duration-350 max-md:ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    )}
                    style={isMobile ? {
                        height: chromeHidden
                            ? "100%"
                            : `calc(100% - ${2 * (Math.max(chromeInsets.top, chromeInsets.bottom) + CONTAINED_GUTTER)}px)`,
                    } : undefined}
                >
                {current.kind === "image" ? (
                    // Zoomable (wheel / pinch / double-tap / drag-pan). Keyed by URL so
                    // paging remounts it at 1x. While zoomed it stops touch events, which
                    // is what suspends this container's swipe-paging. Swipe-down-to-close
                    // is integrated (it must arbitrate against zoom/pinch), unlike the
                    // other media kinds which share the SwipeDownToClose wrapper below.
                    <ZoomableImage
                        key={current.fileUrl}
                        src={current.fileUrl}
                        alt={current.fileName}
                        onDismiss={close}
                        onDismissProgress={onDismissProgress}
                        onTap={isMobile ? toggleChrome : undefined}
                        // iOS style: zooming in hides the chrome, coming back to
                        // fit brings it back. Fires only at the 1x boundary, so a
                        // tap-to-show while zoomed isn't fought by pinching.
                        onZoomedChange={isMobile ? setChromeHidden : undefined}
                    />
                ) : (
                    <SwipeDownToClose onDismiss={close} onProgress={onDismissProgress}>
                        {current.kind === "video" ? (
                            <video
                                src={current.fileUrl}
                                controls
                                className="max-h-full md:max-w-[90%]"
                                onClick={(event) => event.stopPropagation()}
                            />
                        ) : current.kind === "audio" ? (
                            // Stop touchstart too, so dragging the seek slider isn't read as a page-swipe
                            <div className="w-full max-w-sm flex flex-col gap-2">
                                <div className="flex items-center justify-center aspect-square bg-surface-gray-1 rounded-lg">
                                    <MusicIcon className="size-12" />
                                </div>
                                <div
                                    className="rounded-lg bg-surface-gray-1 p-3"
                                    onClick={(event) => event.stopPropagation()}
                                    onTouchStart={(event) => event.stopPropagation()}
                                >
                                    <AudioPlayer src={current.fileUrl} />
                                </div>
                            </div>
                        ) : canEmbedPdf ? (
                            // <embed> = native PDF viewer (toolbar, zoom) at full height.
                            // max-w caps it so wide screens keep a dark backdrop to click.
                            // (Touches INSIDE the embed never reach us — the dismiss drag
                            // only works from the frame around it; desktop-only anyway.)
                            <embed
                                src={current.fileUrl}
                                type="application/pdf"
                                className="h-full w-full max-w-5xl rounded-md"
                                onClick={(event) => event.stopPropagation()}
                            />
                        ) : (
                            // No inline preview (non-previewable files, or a PDF paged
                            // into on mobile) — a download/open card, Google-Drive style
                            <div className="px-3 md:px-0 w-full flex items-center justify-center"><DownloadCard attachment={current} isMobile={isMobile} /></div>
                        )}
                    </SwipeDownToClose>
                )}
                </div>
            </div>

            {/* Filmstrip: image thumbnails, icon tiles for PDFs. Only a click
                on the backdrop AROUND the strip closes (target === the padding
                container itself) — a click on the strip's own area, including
                the gap between tiles, is a child target and must not close. */}
            {hasMany && (
                <div
                    ref={setFilmstripEl}
                    className={cn(
                        // Absolute on mobile like the header; the media area
                        // reserves its height while it shows (see above).
                        // Extra bottom padding on mobile = the home-indicator
                        // safe area, so the tiles sit clear of the OS home /
                        // app-switch swipe zone (zero on devices without one).
                        "shrink-0 p-3 transition-opacity duration-150 max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
                        chromeHidden && "pointer-events-none opacity-0",
                    )}
                    onClick={(event) => { if (event.target === event.currentTarget) close() }}
                >
                    {galleryStrip ? (
                        // Paginated gallery: virtualized horizontal strip, so
                        // only visible tiles mount and load their (full-res)
                        // image. Scrolling to the end pages in more (endReached);
                        // increaseViewportBy prefetches a screenful each side so
                        // there is always content beside the active tile and the
                        // pagination fires before a blank edge shows. Paging the
                        // main image re-centers via scrollToIndex (above).
                        <Virtuoso
                            ref={filmstripVirtuosoRef}
                            horizontalDirection
                            data={attachments}
                            className="w-full scroll-fade-x"
                            style={{ height: 48 }}
                            increaseViewportBy={800}
                            // Open centered on the active tile. Radix unmounts
                            // the dialog on close, so this strip REMOUNTS every
                            // open — and the scrollToIndex effect (above) fires
                            // before Virtuoso has measured, so it no-ops until
                            // the first swipe. initialTopMostItemIndex is
                            // Virtuoso's own mount-time scroll and lands it
                            // correctly; the effect then handles later swipes.
                            initialTopMostItemIndex={{ index, align: "center" }}
                            endReached={() => display.onNearEnd?.()}
                            // Virtuoso lays horizontal items out as inline-block,
                            // which align to each other by BASELINE — an image
                            // tile and an icon tile have different baselines, so
                            // icon tiles dropped low and overflowed the row (the
                            // stray vertical scroll). StripItem pins them to top.
                            components={{ Item: StripItem }}
                            itemContent={(thumbIndex, attachment) => (
                                // pr-2 is the inter-tile gap Virtuoso can measure.
                                <div className="pr-2">
                                    <FilmstripThumb
                                        attachment={attachment}
                                        isActive={thumbIndex === index}
                                        onSelect={() => selectIndex(thumbIndex)}
                                    />
                                </div>
                            )}
                        />
                    ) : (
                        // Message strip: few images, so render them all. Centering
                        // lives on the INNER w-max wrapper, not the scroller —
                        // justify-center on an overflowing scroller clips the
                        // leading thumbs past the scroll origin, unreachable by
                        // scrolling OR scrollIntoView (the "selected image missing
                        // on open" bug). w-max + mx-auto centers short strips and
                        // scrolls long ones from a true zero. scroll-fade-x dims
                        // the overflow edges.
                        <div className="max-w-full overflow-x-auto scroll-fade-x">
                            <div className="mx-auto flex w-max items-center gap-2">
                            {attachments.map((attachment, thumbIndex) => (
                                <FilmstripThumb
                                    key={attachment.id}
                                    ref={thumbIndex === index ? activeThumbRef : undefined}
                                    attachment={attachment}
                                    isActive={thumbIndex === index}
                                    onSelect={() => selectIndex(thumbIndex)}
                                />
                            ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </MediaLightbox>
    )
}

/** Filmstrip tile icon for non-image kinds. */
const ThumbIcon = ({ kind }: { kind: Attachment["kind"] }) => {
    const Icon = kind === "video" ? Film : kind === "audio" ? Music : FileText
    return <Icon className="h-5 w-5 text-ink-gray-5" />
}

/** One filmstrip tile — image thumbnail or a kind icon, with a filename
 *  tooltip. Cheap now that tiles use stored thumbnails (not full-res), so a
 *  Radix tooltip per loaded tile is fine at the counts we page in. forwardRef
 *  so the strip can point activeThumbRef at the selected tile for scrollIntoView. */
const FilmstripThumb = forwardRef<HTMLDivElement, {
    attachment: Attachment
    isActive: boolean
    onSelect: () => void
}>(({ attachment, isActive, onSelect }, ref) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <div
                ref={ref}
                className={cn(
                    "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 bg-surface-gray-2 transition-all duration-200",
                    isActive ? "border-outline-blue-4" : "border-transparent hover:border-outline-gray-3",
                )}
                onClick={(event) => {
                    event.stopPropagation()
                    onSelect()
                }}
            >
                {attachment.kind === "image" ? (
                    <img
                        src={attachment.thumbnail || attachment.fileUrl}
                        alt={attachment.fileName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <ThumbIcon kind={attachment.kind} />
                )}
            </div>
        </TooltipTrigger>
        <TooltipContent>{attachment.fileName}</TooltipContent>
    </Tooltip>
))
FilmstripThumb.displayName = "FilmstripThumb"

/** Virtuoso horizontal item wrapper. align-top defeats the inline-block
 *  baseline alignment that dropped icon tiles below image tiles (and forced a
 *  vertical scrollbar). Spreads Virtuoso's positioning props/ref untouched. */
const StripItem = forwardRef<HTMLDivElement, React.ComponentProps<"div">>((props, ref) => (
    <div {...props} ref={ref} className={cn("align-top", props.className)} />
))
StripItem.displayName = "StripItem"

/**
 * Centered "no preview" card for attachments we can't render inline — other
 * file types, and a PDF paged into on mobile (which can't embed). A mobile PDF
 * can still be viewed via the OS viewer, so it offers "Open" (new tab); other
 * files just "Download". Stops propagation so clicking the card doesn't close;
 * the surrounding backdrop still does.
 */
const DownloadCard = ({ attachment, isMobile }: { attachment: Attachment; isMobile: boolean }) => {
    const openInTab = isMobile && attachment.kind === "pdf"
    const action = () =>
        openInTab
            ? window.open(attachment.fileUrl, "_blank", "noopener")
            : downloadFile(attachment.fileUrl, attachment.fileName)

    return (
        <div
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-surface-gray-1 p-10 text-center"
            onClick={(event) => event.stopPropagation()}
        >
            <FileTypeIcon fileType={getFileExtension(attachment.fileName)} size='4xl' />
            <div className="flex flex-col gap-1">
                <p className="font-medium text-ink-gray-8 break-all">{attachment.fileName}</p>
                <p className="text-sm text-ink-gray-5">{_("No preview available")}</p>
            </div>
            <Button variant="solid" theme="gray" onClick={action}>
                {openInTab ? _("Open") : _("Download")}
            </Button>
        </div>
    )
}
