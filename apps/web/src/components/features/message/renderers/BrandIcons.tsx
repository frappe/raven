import type { CSSProperties } from "react"
import { cn } from "@lib/utils"

/**
 * Brand glyphs served by the backend (raven/public/brand_icons). Most are
 * monochrome simple-icons paths, painted in the brand colour via CSS mask
 * (an <img> can't be tinted). `color: null` = full-colour logo, rendered
 * as a plain <img>. Black brand marks (X, GitHub, Wikipedia) are painted
 * with the ink token instead of #000 — a true black mark disappears on a
 * dark background. Glyphs whose CUTOUTS are part of the brand (YouTube's
 * play triangle, the Apple note shapes) set `counterspace`: a white plate
 * behind the mask so the cutouts read white in both themes instead of
 * showing the surface behind the glyph.
 */
const BRAND_ICON_BASE = "/assets/raven/brand_icons/"
export type BrandSpec = {
    file: string
    color: string | null
    /** Position classes for the white plate behind the mask (see BrandIcon):
     *  a slightly-inset copy of the glyph's silhouette, so the plate hides
     *  under the opaque mark but shows through every cutout. */
    counterspace?: string
}
export const BRAND = {
    // Plate shapes: the YouTube mark is a wide rounded rect (~17-83% tall),
    // YT Music a full circle, the Apple marks full-bleed rounded squares.
    // Each plate is inset a few percent so its edge never peeks past the glyph.
    youtube: { file: "youtube.svg", color: "#FF0000", counterspace: "inset-x-[6%] inset-y-[21%] rounded-[20%]" },
    youtubeMusic: { file: "youtubemusic.svg", color: "#FF0000", counterspace: "inset-[6%] rounded-full" },
    spotify: { file: "spotify.svg", color: "#1ED760" },
    appleMusic: { file: "applemusic.svg", color: "#FA243C", counterspace: "inset-[6%] rounded-[20%]" },
    applePodcasts: { file: "applepodcasts.svg", color: "#9933CC", counterspace: "inset-[6%] rounded-[20%]" },
    soundcloud: { file: "soundcloud.svg", color: "#FF5500" },
    loom: { file: "loom.svg", color: "#625DF5" },
    vimeo: { file: "vimeo.svg", color: "#1AB7EA" },
    reddit: { file: "reddit.svg", color: "#FF4500" },
    zoom: { file: "zoom.svg", color: "#0B5CFF" },
    googleMeet: { file: "Google_Meet.svg", color: null },
    wikipedia: { file: "wikipedia.svg", color: "var(--ink-gray-9)" },
    figma: { file: "Figma.svg", color: null },
    frappeMeet: { file: "frappemeet.svg", color: null },
    frappe: { file: "frappe.svg", color: null },
    // The app's own tile (black square, white bird) — used for Raven links.
    raven: { file: "raven.svg", color: null },
    x: { file: "x.svg", color: "var(--ink-gray-9)" },
    github: { file: "github.svg", color: "var(--ink-gray-9)" },
    hackerNews: { file: "ycombinator.svg", color: "#FF6600" },
} satisfies Record<string, BrandSpec>

/** Server provider names (Raven Link Preview.provider) → brand glyph. */
export const PROVIDER_BRAND: Record<string, BrandSpec> = {
    Wikipedia: BRAND.wikipedia,
    Frappe: BRAND.frappe,
    X: BRAND.x,
    GitHub: BRAND.github,
    "Hacker News": BRAND.hackerNews,
    Reddit: BRAND.reddit,
    Figma: BRAND.figma,
    YouTube: BRAND.youtube,
    "YouTube Music": BRAND.youtubeMusic,
    Spotify: BRAND.spotify,
    Vimeo: BRAND.vimeo,
    Loom: BRAND.loom,
    SoundCloud: BRAND.soundcloud,
    "Apple Music": BRAND.appleMusic,
    "Apple Podcasts": BRAND.applePodcasts,
}

/** The masked glyph's inline styles — the mask clips this span to the mark's
 *  silhouette, and the background paints it in the brand colour. */
const maskStyle = (brand: BrandSpec): CSSProperties => ({
    backgroundColor: brand.color ?? undefined,
    maskImage: `url(${BRAND_ICON_BASE}${brand.file})`,
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
    WebkitMaskImage: `url(${BRAND_ICON_BASE}${brand.file})`,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    WebkitMaskSize: "contain",
})

export const BrandIcon = ({ brand, className }: { brand: BrandSpec; className?: string }) => {
    if (!brand.color) {
        return <img src={`${BRAND_ICON_BASE}${brand.file}`} alt="" className={cn("size-12", className)} />
    }
    if (brand.counterspace) {
        return (
            // The plate sits UNDER the mask, so it only shows through the
            // glyph's cutouts (YouTube's play triangle, the Apple notes).
            // Those counter-spaces are white in the real logos, in every
            // theme — hardcoded white on purpose, a brand constant like the
            // hex colours above, not a surface token.
            <span aria-hidden className={cn("relative inline-block size-12", className)}>
                <span className={cn("absolute", brand.counterspace)} style={{ backgroundColor: "#FFFFFF" }} />
                <span className="absolute inset-0" style={maskStyle(brand)} />
            </span>
        )
    }
    return <span aria-hidden className={cn("inline-block size-12", className)} style={maskStyle(brand)} />
}
