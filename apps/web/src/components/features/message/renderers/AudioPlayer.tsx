import { useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@components/ui/button"
import { Slider } from "@components/ui/slider"
import _ from "@lib/translate"

/** Seconds → "m:ss"; guards NaN/Infinity before metadata loads. */
export const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00"
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, "0")}`
}

/**
 * Audio playback state for a hidden <audio> — the native controls can't be
 * styled across browsers, so consumers drive their own UI from this. Spread
 * `audioProps` onto an <audio src=...>; use the rest to render play/seek/time.
 * Shared by the inline album card and the modal's player.
 */
export const useAudioPlayer = () => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)

    const toggle = () => {
        const audio = audioRef.current
        if (!audio) return
        if (audio.paused) audio.play()
        else audio.pause()
    }

    const seek = (seconds: number) => {
        if (audioRef.current) audioRef.current.currentTime = seconds
    }

    const audioProps = {
        ref: audioRef,
        preload: "metadata" as const,
        onLoadedMetadata: (event: React.SyntheticEvent<HTMLAudioElement>) => setDuration(event.currentTarget.duration),
        onTimeUpdate: (event: React.SyntheticEvent<HTMLAudioElement>) => setCurrentTime(event.currentTarget.currentTime),
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onEnded: () => setPlaying(false),
    }

    return { audioProps, playing, currentTime, duration, toggle, seek }
}

/**
 * Horizontal styled player — play/pause + seek bar + time. Used where the
 * cover-card layout doesn't fit (e.g. the attachment modal's audio slide).
 */
export const AudioPlayer = ({ src }: { src?: string }) => {
    const { audioProps, playing, currentTime, duration, toggle, seek } = useAudioPlayer()

    return (
        <div className="flex items-center gap-2">
            <audio src={src} {...audioProps} />
            <Button
                variant="subtle"
                theme="gray"
                size="sm"
                isIconButton
                onClick={toggle}
                aria-label={playing ? _("Pause") : _("Play")}
            >
                {playing ? <Pause /> : <Play />}
            </Button>
            <Slider
                value={[currentTime]}
                min={0}
                max={duration || 1}
                step={1}
                onValueChange={(values) => seek(values[0])}
                aria-label={_("Seek")}
                className="flex-1"
            />
            <span className="shrink-0 text-2xs tabular-nums text-ink-gray-5">
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
        </div>
    )
}
