import { useRef } from "react"
import { cn } from "@lib/utils"
import { WAVEFORM_BARS } from "@lib/voiceNote"

type VoiceWaveformProps = {
    bars: number[]
    /** 0–1 share already played. */
    progress: number
    onSeek: (fraction: number) => void
    onToggle: () => void
    /** Keyboard seek, in seconds (±5). */
    onStep: (deltaSeconds: number) => void
    label: string
    disabled?: boolean
    className?: string
}

const FLAT = new Array<number>(WAVEFORM_BARS).fill(0)

// Touch movement that still counts as a tap, or decides a drag is a scrub (px).
const TOUCH_SLOP = 6

/** Scrubbable waveform shared by the stream card and the composer's review row. */
export const VoiceWaveform = ({ bars, progress, onSeek, onToggle, onStep, label, disabled, className }: VoiceWaveformProps) => {
    const ref = useRef<HTMLDivElement>(null)
    // Touch: where the finger went down, and whether it has turned into a horizontal scrub.
    const touch = useRef<{ x: number; y: number; scrubbing: boolean } | null>(null)
    const shown = bars.length > 0 ? bars : FLAT

    const seekTo = (clientX: number) => {
        const box = ref.current?.getBoundingClientRect()
        if (!box || disabled) return
        onSeek(Math.min(1, Math.max(0, (clientX - box.left) / box.width)))
    }

    return (
        <div
            ref={ref}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-disabled={disabled}
            // Vertical swipes stay page scrolls; only taps and horizontal drags seek.
            // 1px bars and gaps on mobile: 48 bars must fit a phone-width card beside the time and speed.
            // justify-between: in a wide row the 3px-capped bars spread out instead of bunching left.
            className={cn("flex h-6 min-w-0 flex-1 cursor-pointer touch-pan-y items-center justify-between gap-px md:gap-0.5 rounded outline-none focus-visible:focus-ring", className)}
            onPointerDown={(event) => {
                if (event.pointerType !== "mouse") {
                    touch.current = { x: event.clientX, y: event.clientY, scrubbing: false }
                    return
                }
                event.currentTarget.setPointerCapture(event.pointerId)
                seekTo(event.clientX)
            }}
            onPointerMove={(event) => {
                const start = touch.current
                if (start && !start.scrubbing) {
                    const dx = Math.abs(event.clientX - start.x)
                    if (dx < TOUCH_SLOP || dx < Math.abs(event.clientY - start.y)) return
                    start.scrubbing = true
                    event.currentTarget.setPointerCapture(event.pointerId)
                }
                if (event.currentTarget.hasPointerCapture(event.pointerId)) seekTo(event.clientX)
            }}
            onPointerUp={(event) => {
                const start = touch.current
                touch.current = null
                // A tap seeks where it landed; a finished scrub already did.
                if (start && !start.scrubbing && Math.abs(event.clientX - start.x) < TOUCH_SLOP && Math.abs(event.clientY - start.y) < TOUCH_SLOP) seekTo(event.clientX)
            }}
            onPointerCancel={() => {
                // The browser took the gesture for scrolling.
                touch.current = null
            }}
            onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault()
                    onToggle()
                } else if (event.key === "ArrowRight") onStep(5)
                else if (event.key === "ArrowLeft") onStep(-5)
            }}
        >
            {shown.map((height, index) => (
                <span
                    key={index}
                    className={cn("max-w-[3px] min-w-px flex-1 rounded-full transition-colors duration-150", index / shown.length < progress ? "bg-ink-gray-8" : "bg-surface-gray-4")}
                    style={{ height: `${Math.max(12, height)}%` }}
                />
            ))}
        </div>
    )
}
