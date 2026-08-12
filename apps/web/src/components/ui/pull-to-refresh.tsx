import { useEffect, useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { cn } from "@lib/utils"

/** Finger travel is damped by this factor — the pull should feel elastic. */
const PULL_RESISTANCE = 0.5
/** Damped travel that arms the refresh. */
const PULL_THRESHOLD_PX = 64
/** Damped travel cap. */
const PULL_MAX_PX = 96
/** The spinner stays at least this long, so a fast refresh doesn't just blink. */
const MIN_SPINNER_MS = 500
/** Travel before the touch commits to being a pull (vs a horizontal row swipe). */
const PULL_SLOP_PX = 12

/**
 * Touch pull-to-refresh for a scrollable list. Standalone PWAs get no native
 * pull-to-refresh on iOS, and Android's native one RELOADS THE PAGE — so this
 * both provides the gesture and suppresses the native ones (preventDefault on
 * the pull + overscroll containment on the scroller).
 *
 * Contract: wrap the list area and pass the actual SCROLLING element (e.g.
 * Virtuoso's `scrollerRef`) — the pull only arms while it sits at scrollTop 0.
 * `onRefresh` returns a promise; the spinner shows until it settles. The
 * indicator floats over the content (no layout shift), and all drag motion is
 * direct style writes — React state only flips for the refreshing phase.
 */
export const PullToRefresh = ({
    scroller,
    onRefresh,
    className,
    children,
}: {
    scroller: HTMLElement | null
    onRefresh: () => Promise<unknown>
    className?: string
    children: React.ReactNode
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const indicatorRef = useRef<HTMLDivElement>(null)
    const [refreshing, setRefreshing] = useState(false)
    const refreshingRef = useRef(false)

    // Live callbacks for the native listeners (registered once).
    const onRefreshRef = useRef(onRefresh)
    onRefreshRef.current = onRefresh
    const scrollerRef = useRef(scroller)
    scrollerRef.current = scroller

    // Keep Android Chrome's native pull-to-reload out of the picture entirely.
    useEffect(() => {
        if (!scroller) return
        const previous = scroller.style.overscrollBehaviorY
        scroller.style.overscrollBehaviorY = "contain"
        return () => {
            scroller.style.overscrollBehaviorY = previous
        }
    }, [scroller])

    useEffect(() => {
        const wrapper = wrapperRef.current
        if (!wrapper) return

        // null = no active pull for this touch.
        let startY: number | null = null
        let startX = 0
        let pulling = false
        let offset = 0

        const setIndicator = (px: number, animate: boolean) => {
            const el = indicatorRef.current
            if (!el) return
            el.style.transition = animate ? "transform 150ms ease-out, opacity 150ms ease-out" : "none"
            el.style.transform = `translateX(-50%) translateY(${px - 48}px)`
            el.style.opacity = String(Math.min(px / PULL_THRESHOLD_PX, 1))
        }

        const reset = (animate: boolean) => {
            startY = null
            pulling = false
            offset = 0
            setIndicator(0, animate)
        }

        const onTouchStart = (event: TouchEvent) => {
            if (refreshingRef.current || event.touches.length !== 1) return
            // No scroller mounted (empty list — Virtuoso only mounts with rows)
            // means nothing can be scrolled, which is trivially "at the top":
            // empty and error states stay pullable.
            const el = scrollerRef.current
            if (el && el.scrollTop > 0) return
            startY = event.touches[0].clientY
            startX = event.touches[0].clientX
            pulling = false
        }

        const onTouchMove = (event: TouchEvent) => {
            if (startY === null || refreshingRef.current) return
            const el = scrollerRef.current
            if (el && el.scrollTop > 0) {
                reset(true)
                return
            }
            const dy = event.touches[0].clientY - startY
            if (!pulling) {
                const dx = event.touches[0].clientX - startX
                // Horizontal-dominant travel belongs to the row gestures
                // (swipe-to-mark-read); upward travel is a scroll. Only a
                // clearly downward-dominant drag becomes a pull.
                if (Math.abs(dx) > PULL_SLOP_PX && Math.abs(dx) > dy) {
                    startY = null
                    return
                }
                if (dy <= 0) {
                    startY = null
                    return
                }
                if (dy <= PULL_SLOP_PX) return
                pulling = true
            }
            // We own this touch now — stop the scroller's rubber-band / native PTR.
            event.preventDefault()
            offset = Math.min(Math.max(dy, 0) * PULL_RESISTANCE, PULL_MAX_PX)
            setIndicator(offset, false)
        }

        const onTouchEnd = () => {
            if (startY === null) return
            const commit = pulling && offset >= PULL_THRESHOLD_PX
            if (!commit) {
                reset(true)
                return
            }
            startY = null
            pulling = false
            refreshingRef.current = true
            setRefreshing(true)
            setIndicator(PULL_THRESHOLD_PX, true)
            const startedAt = performance.now()
            Promise.resolve()
                .then(() => onRefreshRef.current())
                .catch(() => {
                    // Best-effort: the list's own error handling reports failures.
                })
                .then(() => {
                    const wait = Math.max(0, MIN_SPINNER_MS - (performance.now() - startedAt))
                    window.setTimeout(() => {
                        refreshingRef.current = false
                        setRefreshing(false)
                        reset(true)
                    }, wait)
                })
        }

        // Native, non-passive: preventDefault inside touchmove is what suppresses
        // the scroller's own overscroll — React's synthetic listeners are passive.
        wrapper.addEventListener("touchstart", onTouchStart, { passive: true })
        wrapper.addEventListener("touchmove", onTouchMove, { passive: false })
        wrapper.addEventListener("touchend", onTouchEnd, { passive: true })
        wrapper.addEventListener("touchcancel", onTouchEnd, { passive: true })
        return () => {
            wrapper.removeEventListener("touchstart", onTouchStart)
            wrapper.removeEventListener("touchmove", onTouchMove)
            wrapper.removeEventListener("touchend", onTouchEnd)
            wrapper.removeEventListener("touchcancel", onTouchEnd)
        }
    }, [])

    return (
        <div ref={wrapperRef} className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
            <div
                ref={indicatorRef}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 z-10 opacity-0"
                style={{ transform: "translateX(-50%) translateY(-48px)" }}
            >
                <div className="flex size-9 items-center justify-center rounded-full border border-outline-gray-2 bg-surface-elevation-2 shadow-md">
                    <LoaderCircle className={cn("size-4 text-ink-gray-7", refreshing && "animate-spin")} />
                </div>
            </div>
            {children}
        </div>
    )
}
