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
}

const FLAT = new Array<number>(WAVEFORM_BARS).fill(0)

/** Scrubbable waveform shared by the stream card and the composer's review row. */
export const VoiceWaveform = ({ bars, progress, onSeek, onToggle, onStep, label, disabled }: VoiceWaveformProps) => {
    const ref = useRef<HTMLDivElement>(null)
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
            className="flex h-6 min-w-0 flex-1 cursor-pointer items-center gap-0.5 rounded outline-none focus-visible:focus-ring"
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                seekTo(event.clientX)
            }}
            onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) seekTo(event.clientX)
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
                    className={cn("max-w-[3px] min-w-0.5 flex-1 rounded-full", index / shown.length < progress ? "bg-ink-gray-8" : "bg-surface-gray-4")}
                    style={{ height: `${Math.max(12, height)}%` }}
                />
            ))}
        </div>
    )
}
