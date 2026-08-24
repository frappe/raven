import { createContext, useContext, useSyncExternalStore } from "react"
import { Badge } from "@components/ui/badge"
import { cn } from "@lib/utils"

export type DateOrderEntry = { name: string; label: string }

/**
 * Per-ChatStream store that tracks which date the viewport is currently under, so a single
 * floating pill can show it (instead of N sticky in-stream separators piling at the top). Kept
 * outside React state on purpose: the inline date dividers report their crossings here and only
 * the pill re-renders — the (heavy) message list never does.
 */
export type DateTracker = {
    /** A divider reports whether its top has scrolled above the viewport's top edge. */
    report: (name: string, isAbove: boolean) => void
    /** The ordered list of date dividers currently in the window (document order). */
    setOrder: (order: DateOrderEntry[]) => void
    /** Whether the user is actively scrolling (drives the pill's show/hide). */
    setScrolling: (scrolling: boolean) => void
    subscribe: (listener: () => void) => () => void
    getLabel: () => string | null
    getScrolling: () => boolean
}

export function createDateTracker(): DateTracker {
    const above = new Set<string>()
    let order: DateOrderEntry[] = []
    let label: string | null = null
    let scrolling = false
    const listeners = new Set<() => void>()
    const emit = () => {
        for (const l of listeners) l()
    }

    const recompute = () => {
        // Current date = the LAST divider (document order) whose top has scrolled above the
        // viewport top. When none have, we're at the very top, so fall back to the first date.
        let next: string | null = order.length ? order[0].label : null
        for (const d of order) if (above.has(d.name)) next = d.label
        if (next !== label) {
            label = next
            emit()
        }
    }

    return {
        report(name, isAbove) {
            if (isAbove === above.has(name)) return
            if (isAbove) above.add(name)
            else above.delete(name)
            recompute()
        },
        setOrder(next) {
            order = next
            // Drop names that left the window so a removed date can't linger as "above".
            for (const n of [...above]) if (!next.some((d) => d.name === n)) above.delete(n)
            recompute()
        },
        setScrolling(s) {
            if (s !== scrolling) {
                scrolling = s
                emit()
            }
        },
        subscribe(l) {
            listeners.add(l)
            return () => {
                listeners.delete(l)
            }
        },
        getLabel: () => label,
        getScrolling: () => scrolling,
    }
}

export const DateTrackerContext = createContext<DateTracker | null>(null)

const noopSubscribe = () => () => { }

/**
 * The floating "current date" pill. Rendered OUTSIDE the message scroll container so the
 * scroll-fade mask doesn't fade it, and shown only while scrolling (Telegram-style) — at rest
 * the inline divider already marks the date, so a persistent pill would just duplicate it.
 */
export function FloatingDatePill() {
    const tracker = useContext(DateTrackerContext)
    const label = useSyncExternalStore(
        tracker?.subscribe ?? noopSubscribe,
        () => tracker?.getLabel() ?? null,
        () => null,
    )
    const scrolling = useSyncExternalStore(
        tracker?.subscribe ?? noopSubscribe,
        () => tracker?.getScrolling() ?? false,
        () => false,
    )

    if (!label) return null

    return (
        <div
            aria-hidden={!scrolling}
            className={cn(
                "pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center transition-opacity duration-300",
                scrolling ? "opacity-100" : "opacity-0",
            )}
        >
            <Badge variant="subtle" theme="gray" size="md">
                {label}
            </Badge>
        </div>
    )
}
