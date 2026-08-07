import { useRef } from "react"

/** Hold this long (without drifting/lifting) to fire. Matches MessageActionMenu. */
const LONG_PRESS_MS = 450
/** Finger drift beyond this cancels — it's a scroll, not a hold. */
const SLOP_PX = 10
/** Swallow the synthetic click that follows finger-lift for this long after firing. */
const CLICK_SUPPRESS_MS = 300

/**
 * Touch long-press detector for elements that are also links/buttons.
 *
 * Standalone extraction of MessageActionMenu's press detector (which is
 * entangled with swipe-to-reply and can't be reused directly): pointerdown
 * starts a timer; drift past the slop or lifting cancels it; when it fires,
 * the click that follows finger-lift is swallowed in the capture phase so a
 * host NavLink doesn't navigate. `contextmenu` is prevented while enabled —
 * Android fires it for touch long-press (iOS never does; the timer is the
 * real path there).
 *
 * Spread the returned handlers onto the pressable element:
 *   const longPress = useLongPress(() => setSheetOpen(true), isMobile)
 *   <NavLink {...longPress} ...>
 */
export const useLongPress = (onLongPress: () => void, enabled: boolean = true) => {
    const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null)
    /** Window (not a latch): a long hold may produce NO click at all, and a
     *  latched flag would then eat the next unrelated tap. */
    const suppressClicksUntilRef = useRef(0)

    const cancel = () => {
        if (!pressRef.current) return
        window.clearTimeout(pressRef.current.timer)
        pressRef.current = null
    }

    return {
        onPointerDown: (event: React.PointerEvent) => {
            if (!enabled || event.pointerType !== "touch") return
            cancel()
            const timer = window.setTimeout(() => {
                pressRef.current = null
                suppressClicksUntilRef.current = performance.now() + CLICK_SUPPRESS_MS
                onLongPress()
            }, LONG_PRESS_MS)
            pressRef.current = { timer, x: event.clientX, y: event.clientY }
        },
        onPointerMove: (event: React.PointerEvent) => {
            const press = pressRef.current
            if (
                press &&
                (Math.abs(event.clientX - press.x) > SLOP_PX ||
                    Math.abs(event.clientY - press.y) > SLOP_PX)
            ) {
                cancel()
            }
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
        onClickCapture: (event: React.MouseEvent) => {
            if (performance.now() > suppressClicksUntilRef.current) return
            suppressClicksUntilRef.current = 0
            event.preventDefault()
            event.stopPropagation()
        },
        onContextMenu: (event: React.MouseEvent) => {
            if (enabled) event.preventDefault()
        },
    }
}
