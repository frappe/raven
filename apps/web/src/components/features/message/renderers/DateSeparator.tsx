import { useContext, useEffect, useRef } from "react";
import { Badge } from "@components/ui/badge";
import { DateTrackerContext } from "../messageDateTracker";

/** Nearest scrolling ancestor, used as the IntersectionObserver root. */
function getScrollParent(node: HTMLElement | null): HTMLElement | null {
    let el = node?.parentElement ?? null
    while (el) {
        const overflowY = getComputedStyle(el).overflowY
        if (overflowY === "auto" || overflowY === "scroll") return el
        el = el.parentElement
    }
    return null
}

// One shared IntersectionObserver per distinct scroll root (in practice, the single ChatStream
// viewport) so N date dividers don't spin up N observers. Reference-counted; torn down when its
// last sentinel unmounts. The callback reports whether the sentinel has scrolled ABOVE the root's
// top (distinct from leaving at the bottom) — that's what makes a date the "current" one.
const callbacks = new WeakMap<Element, (isAbove: boolean) => void>()
const rootObservers = new Map<Element | null, { observer: IntersectionObserver; refs: number }>()

function observeSentinel(el: HTMLElement, onChange: (isAbove: boolean) => void) {
    const root = getScrollParent(el)
    let entry = rootObservers.get(root)
    if (!entry) {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    const isAbove = e.boundingClientRect.top < (e.rootBounds?.top ?? 0)
                    callbacks.get(e.target)?.(isAbove)
                }
            },
            { root, threshold: 0 },
        )
        entry = { observer, refs: 0 }
        rootObservers.set(root, entry)
    }
    const current = entry
    callbacks.set(el, onChange)
    current.observer.observe(el)
    current.refs++

    return () => {
        current.observer.unobserve(el)
        callbacks.delete(el)
        if (--current.refs === 0) {
            current.observer.disconnect()
            rootObservers.delete(root)
        }
    }
}

export default function DateSeparator({ name, label }: { name: string; label: string }) {
    // A zero-height marker rendered just above the divider. When it scrolls above the viewport's
    // top, this date becomes the "current" one — reported to the tracker that drives the floating
    // pill. The dividers themselves are plain inline rows (no longer sticky), so nothing piles at
    // the top and there's no block to mask.
    const sentinelRef = useRef<HTMLDivElement>(null)
    const tracker = useContext(DateTrackerContext)

    useEffect(() => {
        const el = sentinelRef.current
        if (!el || !tracker) return
        return observeSentinel(el, (isAbove) => tracker.report(name, isAbove))
    }, [name, tracker])

    return (
        <>
            <div ref={sentinelRef} aria-hidden className="h-0" />
            {/* One full-width line behind the centered badge — a single element, so both visible
                segments are always identical (no per-side opacity race). The badge's opaque fill
                breaks the line in the middle. */}
            <div className="relative flex items-center justify-center py-2">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-surface-gray-2"
                />
                <Badge variant="subtle" theme="gray" size='md' className="relative">{label}</Badge>
            </div>
        </>
    )
}
