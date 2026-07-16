import { cn } from "@lib/utils"
import { useIsMobile } from "@hooks/use-mobile"
import { useHasBeenInView } from "@hooks/useHasBeenInView"
import { type ImageFile } from "./ImageMessage"
import { ReservedImage } from "./ReservedImage"

/**
 * Mobile: each card overlaps the PREVIOUS card by this fraction of that card's
 * own height. Run offsets accumulate over the cards' ACTUAL heights — not
 * multiples of the tallest card — so mixed portrait/landscape batches keep a
 * consistent seam, and the container ends exactly at the last card's bottom
 * edge. (The old ladder stepped by the TALLEST card's height, so a short
 * landscape card after a tall portrait one left phantom container space below
 * the last image — it looked like runaway padding.)
 */
const MOBILE_OVERLAP = 0.4

/** Tiny deterministic string hash — same input always yields the same index. */
const hashString = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return Math.abs(h)
}

/**
 * Normalizes each image into a unit square (longest side = 1), aspect preserved,
 * with a 4:3 fallback for old messages. The pile is then laid out as percentages
 * of a responsive container, so cards keep their own width AND height (the
 * width-peek) and scale together across breakpoints — all from stored dims, no
 * DOM measurement.
 */
const unitDims = (image: ImageFile) => {
    const w = image.width || 4
    const h = image.height || 3
    const s = 1 / Math.max(w, h)
    return { w: w * s, h: h * s }
}

// Only stacking order is tied to depth.
const zByDepth = ["z-30", "z-20", "z-10", "z-0"]

// Side ALTERNATES by depth so the pile always spreads both ways (never ends
// up lopsided); only the MAGNITUDE is seeded off the image name, so it stays
// varied yet balanced. Rotation follows the same side — a card tossed right
// tilts right, which reads naturally. Literal class strings so Tailwind's JIT
// keeps them. Each palette is indexed by a 0–2 magnitude bucket.
//
// MOBILE vs DESKTOP: a phone has spare vertical room but no horizontal room
// (and no hover), so below md the spread is re-aimed — tiny x offsets and a
// gentler tilt (they only need to *hint* at the pile) with a TALLER down-
// ladder doing the peeking, letting the side gutters shrink and the
// container widen. md+ keeps the wider fan, and all hover growth is gated
// behind md: so sticky-hover on touch can never fire it.
// Desktop hover leads with TRANSLATION (the pile visibly spreads sideways)
// while rotation grows gently — a fan of photos sliding apart, not just
// twisting in place. Values are hand-tuned per bucket, deliberately uneven
// between sides for a more organic fan; every hover value must EXCEED its
// rest value or that bucket won't move when the pile fans.
const xRight = [
    "translate-x-2 md:translate-x-6 md:group-hover:translate-x-12",
    "translate-x-2.5 md:translate-x-9 md:group-hover:translate-x-22",
    "translate-x-3 md:translate-x-12 md:group-hover:translate-x-20",
]
const xLeft = [
    "-translate-x-2 md:-translate-x-6 md:group-hover:-translate-x-14",
    "-translate-x-2.5 md:-translate-x-9 md:group-hover:-translate-x-16",
    "-translate-x-3 md:-translate-x-14 md:group-hover:-translate-x-20",
]
// Mobile tilt is barely-there (±1-2°): cascade photos are mostly visible, so
// a pile-sized tilt would read as sloppy rather than casual.
const rotRight = [
    "rotate-2 md:rotate-3 md:group-hover:rotate-6",
    "rotate-3 md:rotate-6 md:group-hover:rotate-9",
    "rotate-4 md:rotate-6 md:group-hover:rotate-12",
]
const rotLeft = [
    "-rotate-3 md:-rotate-3 md:group-hover:-rotate-6",
    "-rotate-4 md:-rotate-6 md:group-hover:-rotate-9",
    "-rotate-2 md:-rotate-6 md:group-hover:-rotate-9",
]
// Desktop vertical is a depth LADDER, not jitter: each card steps progressively
// further down in the order it was sent, so every under-card's bottom edge peeks
// out below the one above it. Indexed by depth, not seeded — order is the whole
// point here. md-only: mobile's vertical run comes from top offsets instead.
const yByDepth = [
    "translate-y-0",
    "md:translate-y-4 md:group-hover:translate-y-6",
    "md:translate-y-8 md:group-hover:translate-y-12",
    "md:translate-y-12 md:group-hover:translate-y-16",
]
// Top card gets just a hint of tilt so it reads natural, not rigid. Its SIDE
// comes from the batch's alternation (below) — only the magnitude is seeded.
const topTiltRight = ["rotate-2", "rotate-4"]
const topTiltLeft = ["-rotate-2", "-rotate-4"]

/**
 * EXPERIMENT — iOS-style stacked photos.
 *
 * Instead of a grid/carousel, a group of images is rendered as a small pile of
 * cards: the NEWEST image on top with a hint of tilt (each photo dealt onto the
 * pile), the older ones beneath peeking out with seeded offset + rotation and
 * their own shadow, like a stack of physical photos. On hover the pile fans open
 * a touch. Clicking opens the existing viewer at the top (newest) image — the
 * rest are reachable from there as before.
 *
 * On MOBILE the pile relaxes into an Instagram-style vertical run: each card
 * sits below the previous one with a MOBILE_OVERLAP seam, keeping the tilt and
 * a hint of sideways jitter — vertical space is cheap on a phone, horizontal
 * isn't, and there's no hover to fan the pile open.
 *
 * The container's size is derived from the cards' stored dimensions (responsive
 * width by breakpoint + a bounding-box aspect ratio), so message heights are
 * deterministic — no resize after paint, no DOM measurement. Only the first four
 * images are drawn; a badge counts the rest.
 */
export const ImageStack = ({ images, onImageClick }: { images: ImageFile[]; onImageClick: (image: ImageFile) => void }) => {
    const isMobile = useIsMobile()
    // Piles are the stream's most expensive renderer (4 decoded images on
    // rotated, shadowed layers each) — so the cards only MOUNT near the
    // viewport. The container itself always renders at its exact final size
    // (pure stored-dims math), so the reservation is perfect: no layout shift
    // when the cards pop in, and offscreen piles cost a gray box.
    const { ref: inViewRef, hasBeenInView } = useHasBeenInView()
    // Batch members arrive oldest-first; the pile shows the LAST four, so its
    // TOP card is the batch's true newest photo — the last one dealt onto the
    // pile, and also the batch's canonical action anchor (see blockFromEvent).
    // Desktop clicks open it; the badge counts the older photos underneath.
    const cards = images.slice(-4)
    const top = cards[cards.length - 1]
    const remaining = images.length - cards.length

    // Normalize every card, then the bounding box is the widest × tallest extent.
    // The container takes that aspect ratio (responsive width set in className);
    // each card is sized as a % of it, so the widest card fills the width and the
    // tallest fills the height — peek in both axes, nothing cut off.
    //
    // On mobile the container is TALLER than the bounding box: it holds the whole
    // vertical run, and cards are placed top-down at their run offsets instead of
    // centered. Each card's offset is the previous card's offset + its ACTUAL
    // height minus the overlap (see MOBILE_OVERLAP) — still purely from stored
    // dims, so message heights stay deterministic.
    const norm = cards.map(unitDims)
    const boxW = Math.max(...norm.map((n) => n.w))
    const boxH = Math.max(...norm.map((n) => n.h))
    let acc = 0
    const tops = norm.map((n) => {
        const top = acc
        acc += n.h * (1 - MOBILE_OVERLAP)
        return top
    })
    const runH = isMobile ? tops[tops.length - 1] + norm[norm.length - 1].h : boxH

    /** Which side the TOP card leans — random per batch, alternated down the pile. */
    const startRight = hashString(cards[0].name + ":side") % 2 === 0


    return (
        // padding = clipping budget, sized per breakpoint — and it's also LAYOUT
        // space, so it must stay tight: in a mixed batch it becomes the gap before
        // the doc pills below. Mobile's run lives INSIDE the container, so the only
        // real overhang is the bottom card's tilt corner (~9px at 4° on a full-width
        // card) + the shadow-md blur — pb-4 covers it. md+ is sized for the HOVER
        // fan: cards slide up to 88px sideways (x-22) and 64px down (y-16), a 9°
        // rotation adds ~19px of corner overhang on a box-filling card, plus the
        // shadow — hence md:px-20 / md:pb-24. Asymmetric
        // vertically — the ladder only steps DOWN; the top only sees rotation
        // overhang + the top card's small hover lift.
        <div
            // contain: the padded wrapper's bounds ARE the pile's clipping budget,
            // so paint containment is free — and it scopes invalidation/raster of
            // the rotated, shadowed cards away from the rest of the stream.
            className="px-6 pt-3 pb-4 md:px-20 md:pt-8 md:pb-24 [contain:layout_paint]"
        >
            <div
                data-message-id={top.message_id}
                // responsive width by breakpoint; mobile takes the width freed by its
                // slimmer gutters. Height follows from the run's aspect ratio (= the
                // bounding box on desktop, box + vertical run on mobile).
                ref={inViewRef}
                className="group relative w-64 cursor-pointer md:w-72 lg:w-80"
                style={{ aspectRatio: boxW / runH }}
                onClick={() => onImageClick(top)}
            >
                {/* Quiet placeholder until the pile nears the viewport */}
                {!hasBeenInView && <div className="absolute inset-0 rounded-lg bg-surface-gray-2" />}
                {hasBeenInView && cards.map((image, index) => {
                    const n = norm[index]
                    // depth counts from the NEWEST card (0 = top of the pile): newer
                    // photos are dealt on top of older ones, so z-order, the fan
                    // offsets and the desktop ladder all key off depth. On mobile the
                    // run position stays chronological (index — oldest at the top of
                    // the run, newest last), and the higher z of newer cards makes
                    // each seam overlap Instagram-style: newer over older.
                    const depth = cards.length - 1 - index
                    const isTop = depth === 0
                    // Tilt sides alternate STRICTLY through the whole pile, top card
                    // included: the batch seeds which side the top card leans (random
                    // per batch, stable), and each card beneath flips the one above —
                    // so two images never lean the same way. Magnitudes stay seeded
                    // per image, so the amount of tilt still varies.
                    const right = depth % 2 === 0 ? startRight : !startRight
                    const mag = hashString(image.name) % 3
                    const x = isTop ? "translate-x-0" : right ? xRight[mag] : xLeft[mag]
                    const r = isTop
                        ? (right ? topTiltRight : topTiltLeft)[hashString(image.name + ":t") % topTiltRight.length]
                        : right ? rotRight[mag] : rotLeft[mag]
                    const y = yByDepth[depth]
                    // Top card lifts gently on hover (desktop only); the rest fan via their palettes.
                    const hover = isTop ? "md:group-hover:-translate-y-1.5" : ""
                    return (
                        <div
                            key={image.name}
                            // Desktop centers each card (inset-0 m-auto); mobile places them
                            // top-down at their run offsets (inset-x-0 mx-auto + top%). No
                            // frame border — depth comes from the shadow. will-change promotes
                            // a card to its own layer ONLY while its stack is hovered (so the
                            // shadow doesn't repaint mid-animation), and the browser frees that
                            // layer afterwards — no permanent per-card layers piling up memory.
                            className={cn(
                                "absolute overflow-hidden rounded-lg bg-surface-gray-2 shadow-md md:shadow-lg md:transition-transform md:duration-300 md:ease-out md:group-hover:will-change-transform",
                                isMobile ? "inset-x-0 mx-auto" : "inset-0 m-auto",
                                zByDepth[depth],
                                x,
                                r,
                                y,
                                hover,
                            )}
                            style={{
                                width: `${(n.w / boxW) * 100}%`,
                                height: `${(n.h / runH) * 100}%`,
                                top: isMobile ? `${(tops[index] / runH) * 100}%` : undefined,
                            }}
                            // Mobile cascade: photos are individually visible, so a tap opens
                            // THE tapped photo (desktop's pile keeps container-click → top).
                            onClick={
                                isMobile
                                    ? (event) => {
                                        event.stopPropagation()
                                        onImageClick(image)
                                    }
                                    : undefined
                            }
                        >
                            <ReservedImage src={image.file_thumbnail || image.file_url} alt={image.file_name} />
                        </div>
                    )
                })}

                {hasBeenInView && remaining > 0 && (
                    // Overlay pill that stays readable on ANY photo, including pure
                    // black or white: a translucent dark scrim + backdrop blur gives
                    // contrast on light images, and the hairline light ring draws the
                    // edge when the photo is as dark as the scrim. black-*/white-* are
                    // the overlay token scales (same ones the dialog backdrops use).
                    <span className="absolute bottom-2 right-2 z-40 inline-flex items-center rounded-full bg-black-600 px-2 py-0.5 text-xs font-medium text-white ring-1 ring-white-300 backdrop-blur-sm">
                        +{remaining}
                    </span>
                )}
            </div>
        </div>
    )
}
