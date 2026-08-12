import { useRef, useState } from "react"
import { cn } from "@lib/utils"

/**
 * Swipe-down-to-close thresholds — shared with ZoomableImage's integrated
 * version (images arbitrate the same drag against zoom/pinch, so they keep
 * their own implementation; the numbers must stay in sync for a uniform feel).
 */
export const DISMISS_DISTANCE = 96
export const DISMISS_VELOCITY = 0.6 // px/ms
/** Vertical travel before a touch commits to the dismiss drag (vs a tap / page-swipe). */
export const DISMISS_SLOP = 12
/** Drag distance mapped to progress 1 (drives the backdrop fade). */
export const DISMISS_PROGRESS_RANGE = 400

type DismissDrag = {
    pointerId: number
    startX: number
    startY: number
    active: boolean
    lastY: number
    lastTime: number
    velocity: number
}

/**
 * Touch-only swipe-down-to-close for lightbox content WITHOUT a gesture engine
 * of its own (video / audio / PDF / download card — images live in
 * ZoomableImage, which must coordinate this same drag with zoom and pinch).
 *
 * A vertical-dominant drag follows the finger (translate + fade) and dismisses
 * when released past DISMISS_DISTANCE or on a downward flick; anything less
 * springs back. Horizontal-dominant travel stands down immediately, so the
 * modal's swipe-paging — and horizontal media controls like a video scrubber —
 * always win. While active, touches stop propagating (a sprung-back drag must
 * not read as a page-swipe) and the synthetic click after a spring-back is
 * swallowed (it would bubble as a backdrop-close tap, defeating the spring).
 *
 * `onProgress` (0..1) is called per move for the backdrop fade — consumers
 * should write styles directly (no React state) to keep the drag at 60fps.
 */
export const SwipeDownToClose = ({
    onDismiss,
    onProgress,
    className,
    children,
}: {
    onDismiss: () => void
    onProgress?: (progress: number) => void
    className?: string
    children: React.ReactNode
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [offsetY, setOffsetY] = useState(0)
    const dragRef = useRef<DismissDrag | null>(null)
    // Mirrors dragRef.current?.active for the touch handlers (they need the live
    // value, not a render snapshot) — and drives the transition classes.
    const [active, setActive] = useState(false)
    const suppressClickRef = useRef(false)

    const onPointerDown = (event: React.PointerEvent) => {
        if (event.pointerType !== "touch" || dragRef.current) return
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            lastY: event.clientY,
            lastTime: event.timeStamp,
            velocity: 0,
        }
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        if (!drag.active) {
            // Horizontal-dominant = page-swipe / scrubber drag; stand down.
            if (Math.abs(dx) > DISMISS_SLOP && Math.abs(dx) > Math.abs(dy)) {
                dragRef.current = null
                return
            }
            if (dy > DISMISS_SLOP && Math.abs(dy) > Math.abs(dx)) {
                drag.active = true
                setActive(true)
                containerRef.current?.setPointerCapture(event.pointerId)
            }
        }
        if (drag.active) {
            const dt = event.timeStamp - drag.lastTime
            if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt
            drag.lastY = event.clientY
            drag.lastTime = event.timeStamp
            const offset = Math.max(0, dy)
            setOffsetY(offset)
            onProgress?.(Math.min(offset / DISMISS_PROGRESS_RANGE, 1))
        }
    }

    const onPointerEnd = (event: React.PointerEvent) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        dragRef.current = null
        if (!drag.active) return
        setActive(false)
        suppressClickRef.current = true
        const dy = event.clientY - drag.startY
        if (event.type !== "pointercancel" && (dy > DISMISS_DISTANCE || drag.velocity > DISMISS_VELOCITY)) {
            onDismiss()
        } else {
            setOffsetY(0)
            onProgress?.(0)
        }
    }

    const blockTouchWhileActive = (event: React.TouchEvent) => {
        if (dragRef.current?.active) event.stopPropagation()
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex h-full w-full min-h-0 items-center justify-center",
                // 1:1 finger tracking mid-drag; animated spring-back on release.
                active ? "transition-none" : "transition-[transform,opacity] duration-150 ease-out",
                className,
            )}
            style={{
                transform: offsetY ? `translateY(${offsetY}px)` : undefined,
                opacity: offsetY ? 1 - Math.min(offsetY / 600, 0.5) : undefined,
            }}
            data-dismiss-active={active || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onTouchMove={blockTouchWhileActive}
            onTouchEnd={blockTouchWhileActive}
            onClick={(event) => {
                // The click synthesized from a sprung-back drag must not bubble
                // to the backdrop-close handler. Real clicks pass through.
                if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    event.stopPropagation()
                }
            }}
        >
            {children}
        </div>
    )
}
