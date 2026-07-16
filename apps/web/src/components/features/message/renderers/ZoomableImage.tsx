import { useEffect, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@components/ui/button"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
// Same numbers as the non-image media's wrapper — one uniform dismiss feel.
import { DISMISS_DISTANCE, DISMISS_PROGRESS_RANGE, DISMISS_SLOP, DISMISS_VELOCITY } from "./SwipeDownToClose"

/**
 * Zoomed dismiss (iOS-Photos edge-continuation): while zoomed, a downward drag
 * pans — but once the pan is pinned at the image's bottom boundary, pulling
 * further than this buffer converts the surplus into the dismiss drag. The
 * buffer keeps an ordinary pan that bumps the edge from instantly dismissing.
 */
const OVERPAN_DISMISS_START_PX = 16

const MIN_SCALE = 1
const MAX_SCALE = 6
/** Double-click / double-tap zooms straight to this. */
const TOGGLE_SCALE = 2.5
/** Zoom buttons step by this factor. */
const BUTTON_STEP = 1.5

type Transform = { scale: number; x: number; y: number }

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 }

/**
 * Zoom/pan surface for the lightbox image.
 *
 * Gestures: wheel zooms to the cursor, double-click/tap toggles 1x ↔ 2.5x at
 * the pointed spot, pinch zooms on touch, and dragging pans while zoomed. The
 * +/− pill zooms around the centre; tapping the percentage resets.
 *
 * Contract with the modal: while zoomed (or mid-pinch) touch events are
 * STOPPED here, which is what disables the modal's swipe-paging — panning and
 * paging never fight. Clicks on the empty area around the image still bubble
 * (backdrop-close keeps working) but clicks on the image never do. The
 * transform resets whenever `src` changes (paging to another attachment).
 *
 * Swipe-down-to-close (`onDismiss`): touch-only. At 1x, a vertical-dominant
 * drag past the slop moves the image with the finger (slight shrink + fade);
 * releasing past DISMISS_DISTANCE or with a downward flick dismisses, anything
 * less springs back. While ZOOMED, dismiss works by edge-continuation (iOS
 * Photos): a downward drag pans first, and once the pan pins at the image's
 * bottom boundary, continued pull past OVERPAN_DISMISS_START_PX becomes the
 * same dismiss drag. Horizontal swipes still page (the modal only reads
 * horizontal-dominant travel); pinch always wins over an in-progress dismiss.
 */
export const ZoomableImage = ({
    src,
    alt,
    onDismiss,
    onDismissProgress,
}: {
    src: string
    alt: string
    onDismiss?: () => void
    /** 0..1 while the dismiss drag is held — the modal fades its backdrop with it (direct style write, no state). */
    onDismissProgress?: (progress: number) => void
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [t, setT] = useState<Transform>(IDENTITY)
    // Gesture state lives in refs — pointer math must read the latest values
    // inside native/capture handlers without re-subscribing per render.
    const tRef = useRef(t)
    tRef.current = t
    const pointers = useRef(new Map<number, { x: number; y: number }>())
    const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null)
    const [gesturing, setGesturing] = useState(false)

    // Swipe-down-to-close (touch, 1x only). A touch starts as a CANDIDATE; it
    // commits to the dismiss drag once vertical-dominant travel passes the slop
    // (horizontal-dominant travel cancels it — that's a page-swipe). dismissY
    // drives the follow-the-finger transform; the refs carry velocity for the
    // flick check and suppress the synthetic click after a spring-back.
    const [dismissY, setDismissY] = useState(0)
    const dismissRef = useRef<{
        pointerId: number
        startX: number
        startY: number
        active: boolean
        lastY: number
        lastTime: number
        velocity: number
    } | null>(null)
    const suppressClickRef = useRef(false)
    /** Cumulative downward pull past the pan boundary while zoomed (dismiss handoff). */
    const overpanRef = useRef(0)

    /** Velocity + offset bookkeeping for an ACTIVE dismiss drag (1x and zoomed paths). */
    const trackDismissMove = (event: React.PointerEvent, drag: NonNullable<typeof dismissRef.current>) => {
        const dt = event.timeStamp - drag.lastTime
        if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt
        drag.lastY = event.clientY
        drag.lastTime = event.timeStamp
        const offset = Math.max(0, event.clientY - drag.startY)
        setDismissY(offset)
        onDismissProgress?.(Math.min(offset / DISMISS_PROGRESS_RANGE, 1))
    }

    // Paging to another attachment starts fresh.
    useEffect(() => {
        setT(IDENTITY)
        setDismissY(0)
        overpanRef.current = 0
    }, [src])

    /** Pan limit for a given scale (also the zoomed-dismiss boundary check). */
    const panBound = (scale: number): number => {
        const rect = containerRef.current?.getBoundingClientRect()
        return rect ? ((scale - 1) * Math.max(rect.width, rect.height)) / 2 : 0
    }

    /** Clamp the pan so the image can't be flung entirely out of view. */
    const clamp = (next: Transform): Transform => {
        const bound = panBound(next.scale)
        return {
            scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale)),
            x: Math.min(bound, Math.max(-bound, next.x)),
            y: Math.min(bound, Math.max(-bound, next.y)),
        }
    }

    /** Rescale keeping the viewport point (clientX/Y) visually stationary. */
    const zoomAt = (clientX: number, clientY: number, nextScale: number) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const prev = tRef.current
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
        const px = clientX - (rect.left + rect.width / 2)
        const py = clientY - (rect.top + rect.height / 2)
        const k = scale / prev.scale
        const next = clamp({ scale, x: px - (px - prev.x) * k, y: py - (py - prev.y) * k })
        setT(next.scale === 1 ? IDENTITY : next)
    }

    // Wheel zoom needs preventDefault, and React's root wheel listener is
    // passive — so a native non-passive listener it is.
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const onWheel = (event: WheelEvent) => {
            event.preventDefault()
            zoomAt(event.clientX, event.clientY, tRef.current.scale * Math.exp(-event.deltaY * 0.0022))
        }
        el.addEventListener("wheel", onWheel, { passive: false })
        return () => el.removeEventListener("wheel", onWheel)
        // zoomAt reads everything through refs, so subscribing once is safe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onPointerDown = (event: React.PointerEvent) => {
        // Gestures never start on the zoom controls. And capture the pointer ONLY
        // when a gesture actually starts: pointer capture retargets the subsequent
        // click to this container, where it read as a backdrop click — that's what
        // made the zoom buttons close the modal.
        if ((event.target as HTMLElement).closest("[data-zoom-controls]")) return
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()]
            pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
            for (const id of pointers.current.keys()) containerRef.current?.setPointerCapture(id)
            setGesturing(true)
            // A second finger means pinch — abandon any dismiss drag in progress.
            dismissRef.current = null
            overpanRef.current = 0
            setDismissY(0)
            onDismissProgress?.(0)
        } else if (tRef.current.scale > 1) {
            containerRef.current?.setPointerCapture(event.pointerId)
            setGesturing(true)
        } else if (onDismiss && event.pointerType === "touch") {
            // 1x single touch: candidate for the swipe-down-to-close drag.
            dismissRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
                lastY: event.clientY,
                lastTime: event.timeStamp,
                velocity: 0,
            }
        }
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const tracked = pointers.current.get(event.pointerId)
        if (!tracked) return
        const prevPos = { ...tracked }
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

        if (pointers.current.size === 2 && pinchRef.current) {
            // Pinch: rescale around the midpoint + pan with the midpoint drift,
            // as ONE update (the zoom-at-point math and the drift both read the
            // same previous transform).
            const rect = containerRef.current?.getBoundingClientRect()
            const [a, b] = [...pointers.current.values()]
            const dist = Math.hypot(a.x - b.x, a.y - b.y)
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
            const start = pinchRef.current
            if (rect) {
                const prev = tRef.current
                const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * (dist / start.dist)))
                const k = scale / prev.scale
                const px = mid.x - (rect.left + rect.width / 2)
                const py = mid.y - (rect.top + rect.height / 2)
                const next = clamp({
                    scale,
                    x: px - (px - prev.x) * k + (mid.x - start.mid.x),
                    y: py - (py - prev.y) * k + (mid.y - start.mid.y),
                })
                setT(next.scale === 1 ? IDENTITY : next)
            }
            pinchRef.current = { dist, mid }
        } else if (pointers.current.size === 1 && dismissRef.current?.pointerId === event.pointerId) {
            // Swipe-down-to-close: decide (1x candidates only — the zoomed path
            // arrives here already active via overpan), then follow the finger.
            // This branch sits BEFORE the pan branch so an active zoomed dismiss
            // keeps receiving the moves.
            const drag = dismissRef.current
            const dx = event.clientX - drag.startX
            const dy = event.clientY - drag.startY
            if (!drag.active) {
                // Horizontal-dominant travel = the modal's page-swipe; stand down.
                if (Math.abs(dx) > DISMISS_SLOP && Math.abs(dx) > Math.abs(dy)) {
                    dismissRef.current = null
                    return
                }
                if (dy > DISMISS_SLOP && Math.abs(dy) > Math.abs(dx)) {
                    drag.active = true
                    containerRef.current?.setPointerCapture(event.pointerId)
                    setGesturing(true)
                }
            }
            if (drag.active) trackDismissMove(event, drag)
        } else if (pointers.current.size === 1 && tRef.current.scale > 1) {
            // Drag pan while zoomed.
            const dx = event.clientX - prevPos.x
            const dy = event.clientY - prevPos.y
            const prev = tRef.current
            const attemptedY = prev.y + dy
            setT(clamp({ ...prev, x: prev.x + dx, y: attemptedY }))

            // Edge-continuation dismiss (iOS Photos): once the pan is pinned at
            // the bottom boundary, further downward pull accumulates as overpan;
            // past the buffer it converts into the dismiss drag — pan and
            // dismiss compose in one continuous motion, no zoom-out-first.
            if (onDismiss && event.pointerType === "touch") {
                const excess = attemptedY - panBound(prev.scale)
                overpanRef.current = Math.max(0, overpanRef.current + excess)
                if (overpanRef.current > OVERPAN_DISMISS_START_PX) {
                    const initialOffset = overpanRef.current - OVERPAN_DISMISS_START_PX
                    overpanRef.current = 0
                    dismissRef.current = {
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        // Back-dated so the dismiss offset starts at the already-pulled
                        // distance — the image continues from under the finger.
                        startY: event.clientY - initialOffset,
                        active: true,
                        lastY: event.clientY,
                        lastTime: event.timeStamp,
                        velocity: 0,
                    }
                    setDismissY(initialOffset)
                    onDismissProgress?.(Math.min(initialOffset / DISMISS_PROGRESS_RANGE, 1))
                }
            }
        }
    }

    const onPointerEnd = (event: React.PointerEvent) => {
        pointers.current.delete(event.pointerId)
        if (pointers.current.size < 2) pinchRef.current = null
        if (pointers.current.size === 0) {
            setGesturing(false)
            overpanRef.current = 0
        }

        const drag = dismissRef.current
        if (drag?.pointerId === event.pointerId) {
            dismissRef.current = null
            if (drag.active) {
                // The synthetic click after this drag must not bubble to backdrop-close.
                suppressClickRef.current = true
                const dy = event.clientY - drag.startY
                if (event.type !== "pointercancel" && (dy > DISMISS_DISTANCE || drag.velocity > DISMISS_VELOCITY)) {
                    onDismiss?.()
                } else {
                    // Below the threshold — spring back (transition returns at gesture end).
                    setDismissY(0)
                    onDismissProgress?.(0)
                }
            }
        }
    }

    /**
     * While zoomed or pinching, the modal must not see touches (no swipe-paging).
     * `multiTouch` latches for the WHOLE sequence: after a pinch, the final
     * touchend arrives with one/zero touches and possibly scale back at 1 — an
     * unlatched check would let the modal read the pinch's finger travel as a
     * page-swipe (the "pinch-in at 100% flips to the next image" bug).
     */
    const multiTouchRef = useRef(false)
    const blockTouchWhenZoomed = (event: React.TouchEvent) => {
        if (event.touches.length > 1) multiTouchRef.current = true
        // An active dismiss drag also keeps its touches to itself (the modal's
        // paging reads touchend travel — a cancelled drag must not page).
        if (tRef.current.scale > 1 || event.touches.length > 1 || multiTouchRef.current || dismissRef.current?.active)
            event.stopPropagation()
        // All fingers up → the sequence is over; the next fresh touch may page.
        if (event.type === "touchend" && event.touches.length === 0) multiTouchRef.current = false
    }

    return (
        <div
            ref={containerRef}
            className="relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden [touch-action:none]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onTouchStart={blockTouchWhenZoomed}
            onTouchMove={blockTouchWhenZoomed}
            onTouchEnd={blockTouchWhenZoomed}
            onDoubleClick={(event) => {
                event.preventDefault()
                if (tRef.current.scale > 1) setT(IDENTITY)
                else zoomAt(event.clientX, event.clientY, TOGGLE_SCALE)
            }}
            onClick={(event) => {
                // A click synthesized from a dismiss drag (spring-back case) must
                // not read as a backdrop-close tap.
                if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    event.stopPropagation()
                    return
                }
                // Empty-frame clicks at 1x bubble to the backdrop (close); clicks
                // on the image — or anywhere while zoomed — never close.
                if (event.target !== event.currentTarget || tRef.current.scale > 1) event.stopPropagation()
            }}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                className={cn(
                    "max-h-full max-w-full select-none object-contain md:max-w-[90%]",
                    // Smooth wheel/double-click zoom, but 1:1 tracking mid-gesture.
                    // (transition-all so the dismiss spring-back also animates
                    // translate + the slight shrink/fade together.)
                    gesturing ? "transition-none" : "transition-all duration-150 ease-out",
                    t.scale > 1 && (gesturing ? "cursor-grabbing" : "cursor-grab"),
                )}
                style={{
                    // Dismiss drag rides on top of the (identity) zoom transform:
                    // follow the finger down, shrink a touch, fade a little.
                    transform: `translate(${t.x}px, ${t.y + dismissY}px) scale(${t.scale * (1 - Math.min(dismissY / 1200, 0.15))})`,
                    opacity: 1 - Math.min(dismissY / 600, 0.5),
                }}
            />

            {/* Zoom controls — centred above the filmstrip; % tap resets */}
            <div
                data-zoom-controls=""
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1"
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
            >
                <Button
                    variant="subtle"
                    size="sm"
                    isIconButton
                    title={_("Zoom out")}
                    disabled={t.scale <= MIN_SCALE}
                    onClick={() => {
                        const rect = containerRef.current?.getBoundingClientRect()
                        if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, t.scale / BUTTON_STEP)
                    }}
                >
                    <Minus />
                </Button>
                <Button variant="subtle" size="sm" className="min-w-14 tabular-nums" title={_("Reset zoom")} onClick={() => setT(IDENTITY)}>
                    {Math.round(t.scale * 100)}%
                </Button>
                <Button
                    variant="subtle"
                    size="sm"
                    isIconButton
                    title={_("Zoom in")}
                    disabled={t.scale >= MAX_SCALE}
                    onClick={() => {
                        const rect = containerRef.current?.getBoundingClientRect()
                        if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, t.scale * BUTTON_STEP)
                    }}
                >
                    <Plus />
                </Button>
            </div>
        </div>
    )
}
