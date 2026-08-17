import { useContext, useState, type ReactNode } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@components/ui/hover-card"
import { useLinkPreview } from "@stores/linkPreviews/useLinkPreview"
import { linkPreviewStore, type LinkPreviewData } from "@stores/linkPreviews/store"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { getDateObject } from "@lib/date"
import { BRAND, BrandIcon, PROVIDER_BRAND } from "./BrandIcons"
import { fitImageBox } from "./ReservedImage"
import _ from "@lib/translate"

/**
 * The generic link preview — the card for blogs, articles, HN posts and
 * every other link the provider embeds don't render themselves. Embeds
 * (YouTube, Spotify, meeting cards …) are content and always show; THIS
 * preview is metadata about a page, and the user chooses how it appears
 * via Raven User.link_previews:
 *
 *   "Preview Card" — a card under the message (desktop and mobile)
 *   "Link Hover"   — a floating card when hovering the link, keeping the
 *                    stream compact. Hover does not exist on touch, so on
 *                    mobile this simply means no preview (a tap always
 *                    opens the LINK — never the preview).
 */

/** The user's preview mode. Users from before the field existed get the card. */
const usePreviewMode = (): "Link Hover" | "Preview Card" => {
    const { myProfile } = useCurrentRavenUser()
    return myProfile?.link_previews || "Preview Card"
}

/** author · date · points · comments — whatever the stored metadata has. */
const metaLine = (preview: LinkPreviewData): string => {
    const meta = preview.metadata ?? {}
    const parts: string[] = []
    if (typeof meta.author === "string" && meta.author) parts.push(meta.author)
    if (typeof meta.published_on === "string") {
        // Stored verbatim from the page — parse defensively, drop what
        // doesn't parse.
        const date = getDateObject(meta.published_on)
        if (date.isValid()) parts.push(date.format("MMM D, YYYY"))
    }
    if (typeof meta.points === "number") parts.push(`${meta.points} ${_("points")}`)
    if (typeof meta.comments === "number") parts.push(`${meta.comments} ${_("comments")}`)
    return parts.join(" · ")
}

/**
 * Picks the body for a preview. Frappe links have their own branch —
 * deliberately a full copy, not a styled variant of the generic body, so
 * company-specific styling can evolve freely without touching every
 * other card.
 */
const CardBody = ({ preview }: { preview: LinkPreviewData }) =>
    preview.provider === "Frappe" ? (
        <FrappePreviewBody preview={preview} />
    ) : preview.provider === "X" ? (
        <XPreviewBody preview={preview} />
    ) : (
        <PreviewBody preview={preview} />
    )

/**
 * The card for frappe.io links (blog, docs). Starts as the generic
 * layout — restyle it here.
 */
const FrappePreviewBody = ({ preview }: { preview: LinkPreviewData }) => {
    const [imageFailed, setImageFailed] = useState(false)
    const line = metaLine(preview)

    const showImage = Boolean(preview.image) && !imageFailed
    const fail = () => setImageFailed(true)

    return (
        <div className="flex w-full flex-col">
            {showImage && (
                // Edge to edge: no rounding and no side padding — the image
                // runs border to border, and the card wrapper's
                // overflow-hidden clips it to the corners.
                <img
                    src={preview.image}
                    alt=""
                    loading="lazy"
                    // Blog covers are big — decoding on the main thread
                    // mid-scroll drops frames.
                    decoding="async"
                    onError={fail}
                    // The box is sized before the image loads, so the card
                    // never changes shape. Unknown dimensions get the
                    // standard og banner shape (1200x630) and the image
                    // clips into it.
                    style={{
                        aspectRatio:
                            preview.image_width > 0 && preview.image_height > 0
                                ? `${preview.image_width} / ${preview.image_height}`
                                : "1200 / 630",
                    }}
                    className="max-h-64 w-full object-cover"
                />
            )}
            <div className="flex w-full items-center gap-3 p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 pb-1">
                        <BrandIcon brand={BRAND.frappe} className="size-4 shrink-0" />
                        <span className="truncate text-xs text-ink-gray-6">{preview.site_name}</span>
                    </div>
                    {/* Newsreader — the serif from frappe.io itself. A serif
                        needs a little more size than Inter to feel right. */}
                    <div className="line-clamp-2 font-[Newsreader] text-2xl-medium leading-snug text-ink-gray-9">
                        {preview.title}
                    </div>
                    {preview.description && (
                        <p className="line-clamp-2 text-p-sm text-ink-gray-6" title={preview.description}>{preview.description}</p>
                    )}
                    {line && <div className="truncate pt-0.5 text-p-xs text-ink-gray-5">{line}</div>}
                </div>
            </div>
        </div>
    )
}

/**
 * Where the preview image goes, decided from the STORED dimensions before
 * the image loads:
 *
 *   banner — real og banners (landscape, big enough to fill the card
 *            width without upscaling) go full width under the text, at
 *            their own aspect ratio.
 *   thumb  — everything else sits beside the text at a fixed height and
 *            its NATURAL width (never cropped square — most og images
 *            are rectangular). Unknown dimensions also land here, in a
 *            FIXED square box that clips: the fetcher now probes
 *            dimensions (downloads and measures the image), so unknowns
 *            are rare — and a clipped square beats a card that changes
 *            shape when the image loads.
 */
const imagePlacement = (preview: LinkPreviewData): "banner" | "thumb" => {
    const ratio =
        preview.image_width > 0 && preview.image_height > 0
            ? preview.image_width / preview.image_height
            : null
    return ratio !== null && ratio >= 1.4 && preview.image_width >= 400 ? "banner" : "thumb"
}

const ThumbImage = ({ preview, onError }: { preview: LinkPreviewData; onError: () => void }) => {
    const hasDims = preview.image_width > 0 && preview.image_height > 0
    return (
        <img
            src={preview.image}
            alt=""
            loading="lazy"
            // Never decode on the main thread mid-scroll — that drops frames.
            decoding="async"
            onError={onError}
            style={hasDims ? { aspectRatio: `${preview.image_width} / ${preview.image_height}` } : undefined}
            // Known dimensions: natural shape at a fixed height. Unknown:
            // a fixed square that clips, so the card can't change shape
            // when the image loads.
            className={
                hasDims
                    ? "max-h-18 w-auto shrink-0 rounded-md object-cover"
                    : "size-18 shrink-0 rounded-md object-cover"
            }
        />
    )
}

const BannerImage = ({ preview, onError }: { preview: LinkPreviewData; onError: () => void }) => {
    const hasDims = preview.image_width > 0 && preview.image_height > 0
    return (
        <img
            src={preview.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onError}
            // With stored dimensions (the fetcher probes them, so nearly
            // always), the image FITS inside the caps — shrunk, never
            // cropped: a portrait tweet photo shows whole at up to 384px
            // tall (the shared inline-media ceiling), a wide og banner
            // still fills the card. max-w-full lets narrow columns shrink
            // it further; the aspect box keeps the height in step, so the
            // card size is known before the image loads either way.
            // Without dimensions (old rows, failed probes): the old fixed
            // 16:9 crop box.
            style={hasDims ? fitImageBox(preview.image_width, preview.image_height, 488, 384) : { aspectRatio: "16 / 9" }}
            className={hasDims ? "max-w-full rounded" : "max-h-56 w-full rounded object-cover"}
        />
    )
}

/** A media-less tweet's og:image is the author's AVATAR (X serves it under
 *  /profile_images/) — a giant profile picture is worse than no image. The
 *  fetcher now drops these at save; this guard covers previews stored
 *  before it did. */
const isXProfileImage = (preview: LinkPreviewData) =>
    preview.provider === "X" && preview.image.includes("/profile_images/")

/**
 * The card for X posts. Content-first, unlike the generic card: the TWEET
 * TEXT is the headline (real line breaks, six-line clamp so a full
 * 280-character post fits), the author is a muted byline, and the X mark
 * sits on the right. Media renders below at its true aspect, fitted
 * (BannerImage).
 */
const XPreviewBody = ({ preview }: { preview: LinkPreviewData }) => {
    const [imageFailed, setImageFailed] = useState(false)
    const line = metaLine(preview)
    const showImage = Boolean(preview.image) && !imageFailed && !isXProfileImage(preview)

    return (
        <div className="flex w-full flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm-medium leading-snug text-ink-gray-7">{preview.title}</span>
                <BrandIcon brand={BRAND.x} className="size-4 shrink-0" />
            </div>
            {preview.description && (
                <p
                    className="line-clamp-6 whitespace-pre-line text-p-base text-ink-gray-9 mb-1"
                    title={preview.description}
                >
                    {preview.description}
                </p>
            )}
            {showImage && <BannerImage preview={preview} onError={() => setImageFailed(true)} />}
            {line && <div className="truncate text-xs text-ink-gray-5">{line}</div>}
        </div>
    )
}

/** The card's content. Presentation only — wrappers decide interactivity. */
const PreviewBody = ({ preview }: { preview: LinkPreviewData }) => {
    // A dead thumbnail URL must not leave a broken-image box.
    const [imageFailed, setImageFailed] = useState(false)
    const line = metaLine(preview)
    const brand = PROVIDER_BRAND[preview.provider]

    const showImage = Boolean(preview.image) && !imageFailed
    const placement = imagePlacement(preview)
    const fail = () => setImageFailed(true)

    return (
        <div className="flex w-full flex-col gap-2 p-3">
            <div className="flex w-full items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 pb-0.5">
                        {brand && <BrandIcon brand={brand} className="size-3.5 shrink-0" />}
                        <span className="truncate text-xs leading-snug text-ink-gray-6">{preview.site_name}</span>
                    </div>
                    <div className="line-clamp-1 text-p-base-medium text-ink-gray-9">{preview.title}</div>
                    {preview.description && (
                        <p className="line-clamp-2 text-p-sm text-ink-gray-6" title={preview.description}>{preview.description}</p>
                    )}
                    {line && <div className="truncate pt-0.5 text-p-xs text-ink-gray-5">{line}</div>}
                </div>
                {showImage && placement === "thumb" && <ThumbImage preview={preview} onError={fail} />}
            </div>
            {showImage && placement === "banner" && <BannerImage preview={preview} onError={fail} />}
        </div>
    )
}

/**
 * The under-message card ("Preview Card" mode), rendered by
 * MessageLinkPreview when no provider embed matched.
 *
 * NOT visibility-gated on purpose: the window's previews arrive with the
 * messages themselves (the get_messages side-car seeds the store before
 * rows render), so the card paints in the SAME commit as its row. That
 * keeps scrolling smooth — a card that mounts late inserts height
 * mid-scroll. The hook's own register covers the rare cache miss.
 *
 * Nothing renders until the server has a fetched preview, so plain links
 * stay plain. A FRESH message's card pops in when its fetch completes —
 * deliberately, with no loading skeleton: that only happens at the
 * bottom-anchored live edge where arriving content is expected motion
 * (Slack and Discord behave the same), and a skeleton there would guess
 * heights wrong and collapse on failed fetches. See Phase 5 of
 * docs/link-previews-plan.md for the full decision.
 */
export const MessageLinkPreviewCard = ({ href }: { href: string }) => {
    const mode = usePreviewMode()
    const active = mode === "Preview Card"
    const preview = useLinkPreview(active ? href : undefined)

    if (!active) return null

    const ready = preview?.status === "Fetched" && preview.title
    if (!ready) return null

    return (
        <div className="w-full pt-0.5">
            {ready && (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    data-media-root=""
                    // No padding here — each body pads itself, so the Frappe
                    // branch can bleed its image to the card's edges.
                    // overflow-hidden clips a bled image to the corners.
                    className="my-0.5 block w-full max-w-lg overflow-hidden rounded-md border bg-surface-base border-outline-gray-2 transition-colors hover:border-outline-gray-3 dark:bg-surface-elevation-2"
                >
                    <CardBody preview={preview} />
                </a>
            )}
        </div>
    )
}

/** What the floating card shows before (or instead of) a stored preview:
 *  the bare URL, so the box never opens empty. */
const HoverPreviewContent = ({ href }: { href: string }) => {
    const preview = useLinkPreview(href)
    return (
        <HoverCardContent align="start" className="min-w-[420px] overflow-hidden p-0">
            {preview?.status === "Fetched" && preview.title ? (
                <CardBody preview={preview} />
            ) : (
                <div className="line-clamp-3 p-3 text-p-xs break-all text-ink-gray-5">{href}</div>
            )}
        </HoverCardContent>
    )
}

/**
 * Every anchor in a rendered message body (see RichTextRenderer). Always
 * a plain link; in "Link Hover" mode it also carries the floating preview.
 * Radix's HoverCard only opens for pointer hover, so touch devices never
 * see it — taps just follow the link.
 */
export const MessageLink = ({ href, children }: { href?: string; children: ReactNode }) => {
    const mode = usePreviewMode()
    const { call } = useContext(FrappeContext) as FrappeConfig

    const anchor = (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            // Prefetch on approach: by the time the open delay elapses the
            // batched fetch has usually answered, so the card opens filled.
            onPointerEnter={
                mode === "Link Hover" && href
                    ? () => {
                        linkPreviewStore.setClient(call)
                        linkPreviewStore.register(href)
                    }
                    : undefined
            }
        >
            {children}
        </a>
    )

    if (mode !== "Link Hover" || !href) return anchor

    return (
        <HoverCard openDelay={400} closeDelay={100}>
            <HoverCardTrigger asChild>{anchor}</HoverCardTrigger>
            <HoverPreviewContent href={href} />
        </HoverCard>
    )
}
