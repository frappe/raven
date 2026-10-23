import { useEffect, useRef } from "react"
import { Pause, Play, Send } from "lucide-react"
import { Button } from "@components/ui/button"
import { formatTime, useAudioPlayer } from "@components/features/message/renderers/AudioPlayer"
import { VoiceWaveform } from "@components/features/message/renderers/VoiceWaveform"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { voicePlaybackStore } from "@stores/voicePlayback/store"
import type { VoiceDraft } from "./useVoiceDraft"

type VoiceReviewRowProps = {
    draft: VoiceDraft
    /** Send was pressed and the upload is still running. */
    sending: boolean
    /** Also retries a failed upload, then sends. */
    onSend: () => void
}

/** A recorded clip before it goes out: play it back, scrub, then Send. */
export const VoiceReviewRow = ({ draft, sending, onSend }: VoiceReviewRowProps) => {
    const isMobile = useIsMobile()
    const sendRef = useRef<HTMLButtonElement>(null)
    const player = useAudioPlayer()
    const duration = draft.voice?.duration ?? draft.seconds
    const failed = draft.upload.status === "failed"
    const buttonSize = isMobile ? "lg" : "sm"

    // Desktop: Enter sends without reaching for the mouse.
    useEffect(() => {
        if (!isMobile) sendRef.current?.focus()
    }, [isMobile])

    const togglePlayback = () => {
        voicePlaybackStore.pause()
        player.toggle()
    }

    return (
        <>
            <audio src={draft.url} {...player.audioProps} />
            <Button
                variant="subtle"
                size={buttonSize}
                isIconButton
                type="button"
                className="rounded-full"
                aria-label={player.playing ? _("Pause") : _("Play")}
                onClick={togglePlayback}
            >
                {player.playing ? <Pause /> : <Play />}
            </Button>
            <VoiceWaveform
                bars={draft.voice?.waveform ?? []}
                progress={duration > 0 ? player.currentTime / duration : 0}
                label={_("Seek")}
                onSeek={(fraction) => player.seek(fraction * duration)}
                onToggle={togglePlayback}
                onStep={(delta) => player.seek(Math.min(duration, Math.max(0, player.currentTime + delta)))}
            />
            <span className="w-10 shrink-0 text-right text-base md:text-sm tabular-nums text-ink-gray-5">
                {formatTime(player.playing || player.currentTime > 0 ? Math.max(0, duration - player.currentTime) : duration)}
            </span>
            <Button
                ref={sendRef}
                variant="solid"
                size={buttonSize}
                isIconButton
                type="button"
                className={isMobile ? "rounded-full" : undefined}
                aria-label={failed ? _("Retry upload") : _("Send voice note")}
                onClick={onSend}
                loading={sending}
            >
                <Send />
            </Button>
        </>
    )
}
