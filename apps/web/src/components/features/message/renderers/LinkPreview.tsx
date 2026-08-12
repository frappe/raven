import { useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { Play, Link2, Video } from "lucide-react"
import { cn } from "@lib/utils"
import { useTheme } from "@components/theme-provider"
import { Button } from "@components/ui/button"
import type { Message } from "@raven/types/common/Message"
import _ from "@lib/translate"
import { useCopyToClipboard } from "usehooks-ts"
import { toast } from "sonner"
import { matchRavenLink, RavenLinkCard } from "./RavenLinkPreview"
import { MessageLinkPreviewCard } from "./LinkPreviewCard"
import { useHasBeenInView } from "@hooks/useHasBeenInView"
import { useLinkPreview } from "@stores/linkPreviews/useLinkPreview"

import { BRAND, BrandIcon, type BrandSpec } from "./BrandIcons"

/**
 * Link preview under a message.
 *
 * `message.links` is the server-extracted, newline-separated list of URLs in the
 * body. Like Slack, only the FIRST link gets a preview; `hide_link_preview`
 * suppresses it entirely.
 *
 * Provider model: the first provider whose matcher recognises the URL renders
 * its embed — YouTube (videos incl. Music tracks, playlists), Spotify, Apple
 * Music + Podcasts, Loom, Vimeo, SoundCloud, Reddit. Every embed is a fixed-size
 * lazy iframe (or a click-to-play facade), so message heights stay deterministic
 * for the scroll engine and offscreen messages cost nothing. Links no embed
 * matches fall through to the generic preview card (LinkPreviewCard, fed by
 * the server-fetched store — Wikipedia summaries land there too).
 * Figma is deliberately NOT a provider: team files are mostly private, and
 * third-party-cookie partitioning means the embed shows a login wall that
 * doesn't even survive a refresh — it'll come back as a workspace OAuth
 * integration with server-side unfurl instead (Slack-style).
 */
export const MessageLinkPreview = ({ message }: { message: Message }) => {
    const href = message.hide_link_preview ? undefined : firstLink(message.links)
    // Memoised on the URL — two wins for the stream:
    //   1. the provider walk (URL parse × matcher chain) runs once per link,
    //      not on every render of every link-bearing message;
    //   2. re-renders (a reaction landing, a pin) reuse the SAME element, so
    //      React bails out of reconciling the whole embed subtree.
    return useMemo(() => {
        if (!href) return null
        // Admin blocklist (Raven Settings → Blocked Links), domain rows
        // only: kills embeds AND the card. Exact-URL rows need no client
        // logic — the server never hands out their data, so the card
        // never materialises (and those links have no embeds to kill).
        if (isBlockedPreviewDomain(href)) return null
        for (const render of PROVIDERS) {
            const embed = render(href)
            if (embed) return embed
        }
        // No provider embed — the generic preview card (blogs, articles,
        // HN …). Unlike embeds, this one is governed by the user's
        // link_previews preference; the component handles that itself.
        return <MessageLinkPreviewCard href={href} />
    }, [href])
}

/** First non-empty line — the only link that gets a preview (Slack behaviour). */
const firstLink = (links?: string) => links?.split("\n").map((l) => l.trim()).find(Boolean)

/**
 * Shared box for provider embeds: media-root (so the Left-Right layout mirrors
 * it), a fixed per-provider height/aspect via className, and native lazy loading
 * so a channel full of links doesn't boot every player. `wide` uses the same max
 * widths as MessageVideo — for 16:9 video embeds; audio cards keep max-w-md.
 *
 * Until the (lazy) iframe's document loads, the box would be an invisible blank
 * stretch of page — so it carries a surface background + a centred provider
 * icon, removed on the iframe's onLoad (which fires cross-origin too). The
 * background stays: embeds with transparent pages (e.g. Spotify) float their
 * card on it.
 */
const EmbedFrame = ({
    src,
    title,
    className,
    wide,
    allow,
    sandbox,
    allowFullScreen,
    brand,
}: {
    src: string
    title: string
    className: string
    wide?: boolean
    allow?: string
    sandbox?: string
    allowFullScreen?: boolean
    /** Placeholder brand glyph shown while the embed hasn't loaded. */
    brand?: BrandSpec
}) => {
    const [loaded, setLoaded] = useState(false)
    return (
        <div
            data-media-root=""
            className={cn("relative w-full my-2 overflow-hidden rounded-md bg-surface-gray-2", wide ? "max-w-md lg:max-w-lg" : "max-w-md")}
        >
            {!loaded && (
                <span className="absolute inset-0 flex items-center justify-center">
                    {brand ? <BrandIcon brand={brand} /> : <Link2 className="size-8 text-ink-gray-4" />}
                </span>
            )}
            <iframe
                src={src}
                title={title}
                loading="lazy"
                allow={allow}
                sandbox={sandbox}
                allowFullScreen={allowFullScreen}
                onLoad={() => setLoaded(true)}
                // relative so the frame paints above the placeholder icon
                className={cn("relative block w-full", className)}
            />
        </div>
    )
}

/* ------------------------------- YouTube ------------------------------- */

/**
 * Match any YouTube VIDEO URL shape we care about — watch?v=, youtu.be/<id>,
 * shorts/, live/, embed/, v/, on youtube.com / youtube-nocookie (www/m/music
 * subdomains). A YouTube Music track (music.youtube.com/watch?v=…) shares its
 * id with regular YouTube and plays in the same standard embed — `isMusic` just
 * flags it so the embed can render square (album art) instead of 16:9. Returns
 * null for anything else, including unparseable URLs (playlists are matched
 * separately — they have no video id).
 */
/** Videos that never get a preview — a rickroll should stay a surprise.
 *  The server keeps the same list (raven/links.py) and never fetches them. */
const NEVER_PREVIEW_VIDEO_IDS = new Set(["dQw4w9WgXcQ"])

const matchYouTube = (href: string): { videoID: string; isMusic: boolean } | null => {
    try {
        const url = new URL(href)
        const isMusic = url.hostname.startsWith("music.")
        const host = url.hostname.replace(/^(www|m|music)\./, "")
        const found = (id: string | null | undefined) =>
            id && /^[\w-]{6,}$/.test(id) && !NEVER_PREVIEW_VIDEO_IDS.has(id) ? { videoID: id, isMusic } : null
        if (host === "youtu.be") return found(url.pathname.split("/")[1])
        if (host === "youtube.com" || host === "youtube-nocookie.com") {
            if (url.pathname === "/watch") return found(url.searchParams.get("v"))
            const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/)
            return found(match?.[1])
        }
        return null
    } catch {
        return null
    }
}

/** youtube.com/playlist?list=… (incl. YouTube Music playlists) → videoseries embed. */
const matchYouTubePlaylist = (href: string): { listID: string } | null => {
    try {
        const url = new URL(href)
        const host = url.hostname.replace(/^(www|m|music)\./, "")
        if (host !== "youtube.com" || url.pathname !== "/playlist") return null
        const list = url.searchParams.get("list")
        return list && /^[\w-]{10,}$/.test(list) ? { listID: list } : null
    } catch {
        return null
    }
}

/**
 * Click-to-play facade: just the video's thumbnail + a play button, swapping in
 * the real iframe (with autoplay) only when clicked — a channel full of YouTube
 * links must not boot a player per message. Video boxes are aspect-video at the
 * same max widths as MessageVideo; Music tracks are square (album art) at a
 * smaller width. Either way the box is fixed, so message height stays
 * deterministic for the scroll engine in both states.
 *
 * The square facade needs no special thumbnail handling: both thumb sizes centre
 * the square art with pillarbox bars (maxres is 16:9 → ~21.9% bars per side,
 * hqdefault is 4:3 → 12.5%), and object-cover on a square box crops exactly that
 * much per side — the bars trim themselves away in either case.
 */
const YouTubeEmbed = ({ videoID, square, href }: { videoID: string; square?: boolean; href: string }) => {
    const [playing, setPlaying] = useState(false)
    // Best-available thumbnail: maxresdefault only exists for newer/HD videos, so
    // fall back to hqdefault (always present). A missing maxres surfaces either as
    // an error OR as YouTube's tiny grey placeholder served with a 200 — catch that
    // via naturalWidth (the placeholder is 120px; every real thumb is wider).
    const [thumb, setThumb] = useState<"maxresdefault" | "hqdefault">("maxresdefault")
    const fallback = () => setThumb("hqdefault")
    // The video's title, from the stored preview (the server's oEmbed
    // fetch). Asked for only once the facade is near the viewport, and
    // drawn as an OVERLAY on the thumbnail — the box never changes height,
    // whether the title exists, arrives late, or never comes.
    const { ref, hasBeenInView } = useHasBeenInView()
    const preview = useLinkPreview(hasBeenInView ? href : undefined)
    const title = preview?.status === "Fetched" ? preview.title : ""
    return (
        <div
            ref={ref}
            data-media-root=""
            className={cn(
                "w-full overflow-hidden rounded-md [corner-shape:squircle] bg-surface-gray-2 my-2",
                square ? "aspect-square max-w-xs" : "aspect-video max-w-md lg:max-w-lg",
            )}
        >
            {playing ? (
                <iframe
                    className="size-full"
                    src={`https://www.youtube-nocookie.com/embed/${videoID}?autoplay=1`}
                    title={_("YouTube video player")}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            ) : (
                <button
                    type="button"
                    aria-label={_("Play video")}
                    onClick={() => setPlaying(true)}
                    className="group relative block size-full cursor-pointer"
                >
                    <img
                        src={`https://i.ytimg.com/vi/${videoID}/${thumb}.jpg`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={fallback}
                        onLoad={(e) => {
                            if (thumb === "maxresdefault" && e.currentTarget.naturalWidth <= 120) fallback()
                        }}
                        className="size-full object-cover"
                    />
                    <span className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-black-700 transition-colors group-hover:bg-black-800">
                        <Play className="size-6 fill-white text-white" />
                    </span>
                    {title && (
                        <span className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black-800 to-transparent p-2 pb-6 text-left">
                            <p className="line-clamp-1 text-p-sm font-medium text-white">{title}</p>
                        </span>
                    )}
                </button>
            )}
        </div>
    )
}

/* ------------------------------- Spotify ------------------------------- */

/** The open.spotify.com path segments that have a matching /embed/ player. */
const SPOTIFY_KINDS = new Set(["track", "album", "playlist", "episode", "show", "artist"] as const)
type SpotifyKind = typeof SPOTIFY_KINDS extends Set<infer T> ? T : never

/**
 * Match a Spotify share URL — open.spotify.com/<kind>/<id>, optionally with a
 * locale prefix (/intl-en/…) and ?si= share junk. Anything without an embeddable
 * kind + id (e.g. /user/… profiles) returns null. The embed maps 1:1 to
 * /embed/<kind>/<id> at Spotify's fixed player heights (compact for a single
 * track/episode, full card for collections).
 */
const matchSpotify = (href: string): { kind: SpotifyKind; id: string } | null => {
    try {
        const url = new URL(href)
        if (url.hostname !== "open.spotify.com") return null
        const parts = url.pathname.split("/").filter(Boolean)
        if (parts[0]?.startsWith("intl-")) parts.shift()
        const [kind, id] = parts
        if (SPOTIFY_KINDS.has(kind as SpotifyKind) && id && /^[A-Za-z0-9]+$/.test(id)) {
            return { kind: kind as SpotifyKind, id }
        }
        return null
    } catch {
        return null
    }
}

/* --------------------------- Apple Music/Podcasts --------------------------- */

/** music.apple.com / podcasts.apple.com → their embed.* hosts + embeddable kinds. */
const APPLE_HOSTS: Record<string, { embedHost: string; kinds: string[]; title: string; brand: BrandSpec }> = {
    "music.apple.com": { embedHost: "embed.music.apple.com", kinds: ["album", "playlist", "song"], title: "Apple Music player", brand: BRAND.appleMusic },
    "podcasts.apple.com": { embedHost: "embed.podcasts.apple.com", kinds: ["podcast"], title: "Apple Podcasts player", brand: BRAND.applePodcasts },
}

/**
 * Match an Apple Music / Apple Podcasts URL — <host>/<storefront>/<kind>/<slug>/<id>,
 * where ?i=<id> narrows an album to one song / a show to one episode. The embed
 * player lives at embed.<host> under the SAME path; the query is rebuilt keeping
 * only `i` (the rest — ls, l=en-US — is share junk). `compact` = single
 * song/episode, which gets Apple's short card instead of the tall one.
 */
const matchApple = (href: string): { src: string; compact: boolean; title: string; brand: BrandSpec } | null => {
    try {
        const url = new URL(href)
        const config = APPLE_HOSTS[url.hostname]
        if (!config) return null
        const parts = url.pathname.split("/").filter(Boolean)
        // Optional 2-letter storefront ("in", "us", …) before the kind.
        const kindIndex = parts[0]?.length === 2 ? 1 : 0
        const kind = parts[kindIndex]
        if (!kind || !config.kinds.includes(kind)) return null
        if (parts.length < kindIndex + 2) return null // no id after the kind
        const item = url.searchParams.get("i")
        const itemParam = item && /^\d+$/.test(item) ? `?i=${item}` : ""
        return {
            src: `https://${config.embedHost}${url.pathname}${itemParam}`,
            compact: kind === "song" || !!itemParam,
            title: config.title,
            brand: config.brand,
        }
    } catch {
        return null
    }
}

/** The allow/sandbox lists Apple's embed generator prescribes. */
const APPLE_ALLOW = "autoplay *; encrypted-media *; fullscreen *; clipboard-write"
const APPLE_SANDBOX =
    "allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"

/* ------------------------------ Loom / Vimeo ------------------------------ */

/** loom.com/share/<id> → loom.com/embed/<id> (16:9 recording player). */
const matchLoom = (href: string): { id: string } | null => {
    try {
        const url = new URL(href)
        if (url.hostname.replace(/^www\./, "") !== "loom.com") return null
        const [kind, id] = url.pathname.split("/").filter(Boolean)
        return kind === "share" && id && /^[A-Za-z0-9]{16,}$/.test(id) ? { id } : null
    } catch {
        return null
    }
}

/**
 * vimeo.com/<id> → player.vimeo.com/video/<id>. Unlisted links carry a second
 * path segment (the privacy hash) which the player needs as ?h=.
 */
const matchVimeo = (href: string): { src: string } | null => {
    try {
        const url = new URL(href)
        if (url.hostname.replace(/^www\./, "") !== "vimeo.com") return null
        const [id, hash] = url.pathname.split("/").filter(Boolean)
        if (!id || !/^\d+$/.test(id)) return null
        const h = hash && /^[A-Za-z0-9]+$/.test(hash) ? `?h=${hash}` : ""
        return { src: `https://player.vimeo.com/video/${id}${h}` }
    } catch {
        return null
    }
}

/* ------------------------------- SoundCloud ------------------------------- */

/** Non-content first path segments on soundcloud.com (search pages etc.). */
const SOUNDCLOUD_RESERVED = new Set(["discover", "search", "you", "stations", "upload", "charts", "pages", "settings"])

/**
 * soundcloud.com/<user>/<track> or /<user>/sets/<playlist>. The widget takes the
 * PAGE URL itself (no id needed): w.soundcloud.com/player/?url=… — rebuilt from
 * origin + path so share junk doesn't leak in. Tracks get the compact player,
 * sets the tall one. (on.soundcloud.com short links are server-side redirects we
 * can't resolve client-side — those fall through.)
 */
const matchSoundCloud = (href: string): { src: string; isSet: boolean } | null => {
    try {
        const url = new URL(href)
        if (url.hostname.replace(/^www\./, "") !== "soundcloud.com") return null
        const parts = url.pathname.split("/").filter(Boolean)
        if (parts.length < 2 || SOUNDCLOUD_RESERVED.has(parts[0])) return null
        const page = `https://soundcloud.com${url.pathname}`
        return {
            src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(page)}`,
            isSet: parts[1] === "sets",
        }
    } catch {
        return null
    }
}

/* --------------------------------- Reddit --------------------------------- */

/**
 * reddit.com/r/<sub>/comments/<post-id>/… → embed.reddit.com under the SAME
 * path (what Reddit's widgets.js builds from the blockquote embed). Only post
 * permalinks embed; subreddit / user / share-token (/s/) links fall through.
 */
const matchReddit = (href: string): { path: string } | null => {
    try {
        const url = new URL(href)
        if (!/^(www\.|old\.)?reddit\.com$/.test(url.hostname)) return null
        const parts = url.pathname.split("/").filter(Boolean)
        // Shape: r/<sub>/comments/<post-id>[/<slug>[/<comment-id>]]
        if (parts[0] !== "r" || parts[2] !== "comments" || !parts[3]) return null
        // widgets.js always ensures a trailing slash before appending params.
        return { path: url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/` }
    } catch {
        return null
    }
}

/** Cap on the Reddit card — taller posts clamp here and scroll internally. */
const REDDIT_MAX_HEIGHT = 400

/**
 * Reddit post card with the params widgets.js would set: embed=true, the
 * "subreddit-first" minimal style, and theme synced to the app's resolved
 * theme (light = omitted; a theme switch swaps the src, reloading the card).
 * Sandbox/allow lists are verbatim what widgets.js sets on its iframe.
 *
 * Height is MAX-height behaviour: the embed reports its natural height via a
 * resize.embed postMessage (what widgets.js listens for), and we start at the
 * cap and shrink to fit — a comment/text post is often ~150px and a fixed
 * frame would be mostly dead space. The clamp keeps media posts bounded
 * (scrolling internally), and the one-time shrink is the same accepted
 * reflow tradeoff as MessageVideo's metadata load.
 */
const RedditEmbed = ({ path }: { path: string }) => {
    const { themeValue } = useTheme()
    const frameRef = useRef<HTMLIFrameElement>(null)
    const [height, setHeight] = useState(REDDIT_MAX_HEIGHT)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            // Only trust messages from OUR iframe (several posts can be on screen).
            if (event.source !== frameRef.current?.contentWindow || typeof event.data !== "string") return
            try {
                const parsed = JSON.parse(event.data)
                if (parsed?.type === "resize.embed" && typeof parsed.data === "number") {
                    setHeight(Math.min(Math.ceil(parsed.data), REDDIT_MAX_HEIGHT))
                }
            } catch {
                // not a resize message — ignore
            }
        }
        window.addEventListener("message", onMessage)
        return () => window.removeEventListener("message", onMessage)
    }, [])

    return (
        <div data-media-root="" className="relative w-full max-w-md my-2 overflow-hidden rounded-md bg-surface-gray-2">
            {/* Same not-yet-loaded placeholder as EmbedFrame (this box is bespoke
                because of the resize listener). */}
            {!loaded && (
                <span className="absolute inset-0 flex items-center justify-center">
                    <BrandIcon brand={BRAND.reddit} />
                </span>
            )}
            <iframe
                ref={frameRef}
                src={`https://embed.reddit.com${path}?embed=true&style=subreddit-first${themeValue === "dark" ? "&theme=dark" : ""}`}
                title={_("Reddit post")}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups"
                allow="clipboard-read; clipboard-write"
                onLoad={() => setLoaded(true)}
                className="relative block w-full"
                style={{ height }}
            />
        </div>
    )
}

/* ----------------------------- Zoom / Google Meet ----------------------------- */

/** Zoom shows meeting numbers grouped 3-3-4 (10 digits) / 3-4-4 (11 digits). */
const formatMeetingNumber = (n: string) => {
    if (n.length === 10) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
    if (n.length === 11) return `${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`
    return n
}

/**
 * Zoom join links, on any tenant subdomain (company.zoom.us):
 *  - zoom.us/j/<meeting-id>            (share link)
 *  - zoom.us/my/<personal-room>        (PMI vanity link)
 *  - zoom.us/join?confno=<meeting-id>  (web-join form with the number prefilled)
 * A meeting can't be embedded, so the preview is a join card; `detail` is the
 * human identity shown on it — the formatted meeting number or the room name.
 */
export const matchZoom = (href: string): { href: string; detail: string } | null => {
    try {
        const url = new URL(href)
        if (!/(^|\.)zoom\.us$/.test(url.hostname)) return null
        const [kind, id] = url.pathname.split("/").filter(Boolean)
        const confno = url.searchParams.get("confno")
        if (kind === "j" && id && /^\d{8,}$/.test(id)) return { href, detail: formatMeetingNumber(id) }
        if (kind === "my" && id) return { href, detail: id }
        if (kind === "join" && confno && /^\d{8,}$/.test(confno)) return { href, detail: formatMeetingNumber(confno) }
        return null
    } catch {
        return null
    }
}

/** meet.google.com/xxx-yyyy-zzz — the code IS the meeting's human identity. */
export const matchGoogleMeet = (href: string): { href: string; detail: string } | null => {
    try {
        const url = new URL(href)
        if (url.hostname !== "meet.google.com") return null
        const code = url.pathname.split("/").filter(Boolean)[0]
        return code && /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(code) ? { href, detail: code } : null
    } catch {
        return null
    }
}

/**
 * Frappe Meet is self-hosted, so its valid deployments come from Raven Settings
 * (boot.frappe_meet_hosted_urls, newline-separated). Entries are bare hostnames
 * ("suite.frappe.io") but full URLs work too — each line is normalised to a
 * host. Read lazily on FIRST use and cached: boot isn't populated yet when this
 * module is imported in dev, and it never changes within a page load.
 */
/**
 * Domain-wide preview blocks from Raven Settings, via boot (same lazy
 * read as the Frappe Meet hosts below). Suffix matching, like the
 * provider registry: blocking frappe.io covers its subdomains.
 */
let blockedPreviewDomains: string[] | null = null
const isBlockedPreviewDomain = (href: string): boolean => {
    if (blockedPreviewDomains === null) {
        blockedPreviewDomains = (window.frappe?.boot?.link_preview_blocked_domains ?? []) as string[]
    }
    if (blockedPreviewDomains.length === 0) return false
    try {
        const host = new URL(href).hostname.toLowerCase()
        return blockedPreviewDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    } catch {
        return false
    }
}

let frappeMeetHosts: string[] | null = null
const getFrappeMeetHosts = (): string[] => {
    if (frappeMeetHosts) return frappeMeetHosts
    const raw: string = window.frappe?.boot?.frappe_meet_hosted_urls ?? ""
    frappeMeetHosts = raw
        .split("\n")
        .map((line: string) => {
            const trimmed = line.trim()
            if (!trimmed) return ""
            try {
                return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).host
            } catch {
                return ""
            }
        })
        .filter(Boolean)
    return frappeMeetHosts
}

/** <configured-host>/meet/<meeting-id> → join card, like Google Meet. */
export const matchFrappeMeet = (href: string): { href: string; detail: string } | null => {
    try {
        const url = new URL(href)
        if (!getFrappeMeetHosts().includes(url.host)) return null
        const [kind, id] = url.pathname.split("/").filter(Boolean)
        return kind === "meet" && id ? { href, detail: id } : null
    } catch {
        return null
    }
}

/**
 * Join card for meeting links: brand glyph, the meeting's human identity
 * (formatted meeting number / room / code — not the raw URL),
 * and a Join button — brand-coloured when the brand has a colour (inline
 * style, so the ui Button's own hover bg is replaced by an opacity dip).
 * Fixed height, no fetch, opens in a new tab.
 */
const MeetingCard = ({ href, brand, label, detail }: { href: string; brand?: BrandSpec; label: string; detail: string }) => {

    const [, copy] = useCopyToClipboard()

    const handleCopy = () => {
        copy(detail)
        toast.success(_("Copied meeting ID"))
    }
    return <div data-media-root="" className="w-full sm:max-w-sm max-w-xs my-2">
        <div className="flex items-center gap-3 rounded-md border border-outline-gray-2 bg-surface-gray-1 dark:bg-surface-elevation-2 p-3">
            {brand ? <BrandIcon brand={brand} className="shrink-0 size-9" /> : <Video className="size-8 shrink-0 text-ink-gray-6" />}
            <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-base-medium text-ink-gray-9">{label}</div>
                <div className="truncate text-sm leading-snug text-ink-gray-6 cursor-pointer" onClick={handleCopy} role="button" tabIndex={0}>{detail}</div>
            </div>
            <Button
                asChild
                variant="solid"
                size="md"
                className={cn("shrink-0")}
            >
                <a href={href} target="_blank" rel="noopener noreferrer">{_("Join")}</a>
            </Button>
        </div>
    </div>
}

/* ------------------------------- Providers ------------------------------- */

/**
 * Ordered provider chain — first match wins. Each entry is matcher + embed in
 * one place; adding a provider = adding one function here.
 */
const PROVIDERS: Array<(href: string) => ReactElement | null> = [
    // Raven's own links (message permalinks, channels, threads, DMs) — FIRST,
    // so an internal link can never fall through to an external provider.
    (href) => {
        const raven = matchRavenLink(href)
        return raven ? <RavenLinkCard link={raven} /> : null
    },
    (href) => {
        const yt = matchYouTube(href)
        // Keyed by video so an edit that swaps the link resets playing + thumbnail state.
        return yt ? <YouTubeEmbed key={yt.videoID} videoID={yt.videoID} square={yt.isMusic} href={href} /> : null
    },
    (href) => {
        const playlist = matchYouTubePlaylist(href)
        return playlist ? (
            <EmbedFrame
                src={`https://www.youtube-nocookie.com/embed/videoseries?list=${playlist.listID}`}
                title={_("YouTube playlist player")}
                className="aspect-video"
                wide
                brand={BRAND.youtube}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
            />
        ) : null
    },
    (href) => {
        const spotify = matchSpotify(href)
        return spotify ? (
            <EmbedFrame
                src={`https://open.spotify.com/embed/${spotify.kind}/${spotify.id}`}
                title={_("Spotify player")}
                className={spotify.kind === "track" || spotify.kind === "episode" ? "h-[152px]" : "h-[352px]"}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                brand={BRAND.spotify}
            />
        ) : null
    },
    (href) => {
        const apple = matchApple(href)
        return apple ? (
            <EmbedFrame
                src={apple.src}
                title={_(apple.title)}
                className={apple.compact ? "h-[175px]" : "h-[450px]"}
                allow={APPLE_ALLOW}
                sandbox={APPLE_SANDBOX}
                brand={apple.brand}
            />
        ) : null
    },
    (href) => {
        const loom = matchLoom(href)
        return loom ? (
            <EmbedFrame
                src={`https://www.loom.com/embed/${loom.id}`}
                title={_("Loom video player")}
                className="aspect-video"
                wide
                brand={BRAND.loom}
                allow="fullscreen; picture-in-picture; clipboard-write"
                allowFullScreen
            />
        ) : null
    },
    (href) => {
        const vimeo = matchVimeo(href)
        return vimeo ? (
            <EmbedFrame
                src={vimeo.src}
                title={_("Vimeo video player")}
                className="aspect-video"
                wide
                brand={BRAND.vimeo}
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                allowFullScreen
            />
        ) : null
    },
    (href) => {
        const soundcloud = matchSoundCloud(href)
        return soundcloud ? (
            <EmbedFrame
                src={soundcloud.src}
                title={_("SoundCloud player")}
                className={soundcloud.isSet ? "h-[450px]" : "h-[166px]"}
                allow="autoplay; clipboard-write"
                brand={BRAND.soundcloud}
            />
        ) : null
    },
    (href) => {
        const reddit = matchReddit(href)
        return reddit ? <RedditEmbed path={reddit.path} /> : null
    },
    (href) => {
        const zoom = matchZoom(href)
        return zoom ? <MeetingCard href={href} brand={BRAND.zoom} label={_("Zoom meeting")} detail={zoom.detail} /> : null
    },
    (href) => {
        const meet = matchGoogleMeet(href)
        return meet ? <MeetingCard href={href} brand={BRAND.googleMeet} label={_("Google Meet")} detail={meet.detail} /> : null
    },
    (href) => {
        const frappeMeet = matchFrappeMeet(href)
        return frappeMeet ? <MeetingCard href={href} brand={BRAND.frappeMeet} label={_("Frappe Meet")} detail={frappeMeet.detail} /> : null
    },
]
