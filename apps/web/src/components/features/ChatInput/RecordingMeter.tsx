import { useRef, useSyncExternalStore } from "react"
import { useResizeObserver } from "usehooks-ts"
import { formatTime } from "@components/features/message/renderers/AudioPlayer"
import { cn } from "@lib/utils"
import { scaleToLoudest } from "@lib/voiceNote"
import type { RecordingMeter as Meter } from "./recordingMeterStore"

// w-1 bar + gap-0.5
const BAR_PITCH_PX = 6
const BAR_GAP_PX = 2

/** Dot, timer and live levels: the only part of the recorder that re-renders on each tick. */
export const RecordingMeter = ({ meter, live, compact }: { meter: Meter; live: boolean; compact: boolean }) => {
    const { elapsed, levels } = useSyncExternalStore(meter.subscribe, meter.get)
    const barsRef = useRef<HTMLDivElement>(null)
    const { width = 0 } = useResizeObserver({ ref: barsRef as React.RefObject<HTMLElement> })
    // Bars that fit: the last one needs no trailing gap.
    const capacity = Math.floor((width + BAR_GAP_PX) / BAR_PITCH_PX)
    // Bars enter from the right; empty slots hold the left until the meter fills, so the spacing never shifts.
    const emptySlots = Math.max(0, capacity - levels.length)
    const shown = [...new Array<number>(emptySlots).fill(0), ...levels.slice(Math.max(0, levels.length - capacity))]

    return (
        <>
            {/* Grey while the mic opens, red once it's live (the cue to speak) */}
            <span className={cn("size-2 shrink-0 rounded-full", live ? "bg-surface-red-6 animate-pulse" : "bg-surface-gray-4")} />
            {/* Fit to the digits: tabular-nums keeps the width steady as it counts */}
            <span className="shrink-0 text-base md:text-sm tabular-nums text-ink-gray-8">{formatTime(elapsed / 1000)}</span>
            <div
                ref={barsRef}
                // The bars spread so both ends sit flush (the leftover is under one bar's width).
                // Compact: the review waveform's width, so the recorder stays small in a wide composer.
                className={cn("flex h-6 min-w-0 items-center justify-between gap-0.5 overflow-hidden", compact ? "w-60 shrink" : "flex-1")}
                aria-hidden
            >
                {/* Newest on the right */}
                {scaleToLoudest(shown).map((height, index) =>
                    index < emptySlots ? (
                        <span key={index} className="w-1 shrink-0" />
                    ) : (
                        <span key={index} className="w-1 shrink-0 rounded-full bg-ink-gray-5" style={{ height: `${Math.max(12, height)}%` }} />
                    ),
                )}
            </div>
        </>
    )
}
