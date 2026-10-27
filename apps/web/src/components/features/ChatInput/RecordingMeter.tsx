import { useEffect, useRef, useSyncExternalStore } from "react"
import { useResizeObserver } from "usehooks-ts"
import { formatTime } from "@components/features/message/renderers/AudioPlayer"
import { useIsMobile } from "@hooks/use-mobile"
import { cn } from "@lib/utils"
import { TICK_MS, type RecordingMeter as Meter } from "./recordingMeterStore"

// VoiceWaveform's bars: 3px wide, 1px apart on mobile and 2px on desktop.
const BAR_WIDTH_PX = 3

/** Dot, timer and live levels: the only part of the recorder that re-renders on each tick. */
export const RecordingMeter = ({ meter, live, compact }: { meter: Meter; live: boolean; compact: boolean }) => {
    const { elapsed, heights, count } = useSyncExternalStore(meter.subscribe, meter.get)
    const barsRef = useRef<HTMLDivElement>(null)
    const stripRef = useRef<HTMLDivElement>(null)
    const { width = 0 } = useResizeObserver({ ref: barsRef as React.RefObject<HTMLElement> })
    const pitch = BAR_WIDTH_PX + (useIsMobile() ? 1 : 2)
    // Enough bars to fill the meter, plus the newest one sliding in past the right edge.
    const slots = Math.ceil(width / pitch) + 1
    // Empty slots hold the left until the meter fills.
    const emptySlots = Math.max(0, slots - heights.length)
    const shown = heights.slice(Math.max(0, heights.length - slots))
    // Tick number of the first shown bar: keyed by it, a bar keeps its node, so a tick only adds one and drops one.
    const firstTick = count - shown.length

    // Between ticks the strip glides one bar left, so bars move instead of stepping.
    // A transform from the frame clock: no re-render or layout per frame.
    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
        let frame = 0
        let written = ""
        const glide = () => {
            const { tickedAt } = meter.get()
            if (stripRef.current && tickedAt) {
                const progress = Math.min(1, (performance.now() - tickedAt) / TICK_MS)
                const transform = `translateX(${(1 - progress) * pitch}px)`
                // Settled until the next tick: skip the identical write.
                if (transform !== written) stripRef.current.style.transform = written = transform
            }
            frame = requestAnimationFrame(glide)
        }
        frame = requestAnimationFrame(glide)
        return () => cancelAnimationFrame(frame)
    }, [meter, pitch])

    return (
        <>
            {/* Grey while the mic opens, red once it's live (the cue to speak) */}
            <span className={cn("size-2 shrink-0 rounded-full", live ? "bg-surface-red-6 animate-pulse" : "bg-surface-gray-4")} />
            {/* Fit to the digits: tabular-nums keeps the width steady as it counts */}
            <span className="shrink-0 text-base md:text-sm tabular-nums text-ink-gray-8">{formatTime(elapsed / 1000)}</span>
            <div
                ref={barsRef}
                // Compact: the review waveform's width, so the recorder stays small in a wide composer.
                className={cn("relative h-6 min-w-0 overflow-hidden", compact ? "w-60 shrink" : "flex-1")}
                aria-hidden
            >
                {/* Newest on the right; the oldest slides out past the left edge */}
                <div ref={stripRef} className="absolute inset-y-0 right-0 flex items-center gap-px will-change-transform md:gap-0.5">
                    {Array.from({ length: emptySlots }, (_, index) => (
                        <span key={`empty-${index}`} className="w-[3px] shrink-0" />
                    ))}
                    {shown.map((height, index) => (
                        <span key={firstTick + index} className="w-[3px] shrink-0 rounded-full bg-surface-gray-4" style={{ height: `${Math.max(12, height)}%` }} />
                    ))}
                </div>
            </div>
        </>
    )
}
