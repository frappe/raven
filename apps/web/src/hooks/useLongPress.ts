import { useEffect, useRef } from "react"
import { hapticTick } from "@utils/haptics"

/**
 * Simple long-press for a single control: arm on pointerdown, stand down when
 * the finger travels (a drag/scroll, not a hold) or settles early, fire after
 * `ms` with a haptic tick. Spread the returned `handlers` on the element.
 *
 * The click that follows a fired long-press must usually be swallowed (the
 * pointerup still synthesizes one) — call `consumeLongPress()` first thing in
 * the element's onClick: it reports whether the press fired and clears the
 * latch, so exactly one click gets eaten per fired press.
 *
 * Travel uses pointermove, NOT pointerleave: touch pointers are implicitly
 * captured by the pressed element, so pointerleave never fires mid-drag.
 * onContextMenu is suppressed — a long-press is what raises the OS context
 * menu, and this hook exists to give that hold a different meaning.
 *
 * Deliberately NOT used by MessageActionMenu: the message long-press is
 * interwoven with swipe-to-reply arbitration, a two-stage press highlight and
 * click-suppression windows — a hook generic enough to host that would obscure
 * both. The defaults here mirror its timings so the app keeps one rhythm.
 */
export const useLongPress = (
    onLongPress: () => void,
    { ms = 450, slopPx = 10, haptic = true }: { ms?: number; slopPx?: number; haptic?: boolean } = {},
) => {
    // The timer calls the LATEST handler — the ref keeps it fresh without
    // rebuilding the handlers each render.
    const onLongPressRef = useRef(onLongPress)
    onLongPressRef.current = onLongPress

    const timerRef = useRef<number | null>(null)
    const firedRef = useRef(false)
    const originRef = useRef<{ x: number; y: number } | null>(null)

    const disarm = () => {
        originRef.current = null
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }

    // Unmount with a press still held: kill the pending timer so it can't
    // fire against a dead instance.
    useEffect(() => disarm, [])

    const handlers = {
        onPointerDown: (event: React.PointerEvent) => {
            firedRef.current = false
            disarm()
            originRef.current = { x: event.clientX, y: event.clientY }
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null
                firedRef.current = true
                if (haptic) hapticTick()
                onLongPressRef.current()
            }, ms)
        },
        onPointerMove: (event: React.PointerEvent) => {
            const origin = originRef.current
            if (!origin) return
            if (Math.abs(event.clientX - origin.x) > slopPx || Math.abs(event.clientY - origin.y) > slopPx) {
                disarm()
            }
        },
        onPointerUp: disarm,
        onPointerLeave: disarm,
        onPointerCancel: disarm,
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    }

    /** True when the last press fired (and swallow it) — see the doc above. */
    const consumeLongPress = () => {
        if (!firedRef.current) return false
        firedRef.current = false
        return true
    }

    return { handlers, consumeLongPress }
}
