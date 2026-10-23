import { Pause, Play, SendHorizontalIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { formatTime } from "@components/features/message/renderers/AudioPlayer"
import { VoiceWaveform } from "@components/features/message/renderers/VoiceWaveform"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { WAVEFORM_BARS } from "@lib/voiceNote"
import { voicePlaybackStore } from "@stores/voicePlayback/store"
import { useVoicePlayback } from "@stores/voicePlayback/useVoicePlayback"
import type { VoiceDraft } from "./useVoiceDraft"
import { DesktopTooltip } from "./DesktopTooltip"

type VoiceReviewRowProps = {
    draft: VoiceDraft
    /** Send was pressed and the upload is still running. */
    sending: boolean
    /** Mobile's own Send; also retries a failed upload. Omitted on desktop, where the composer's Send button sends. */
    onSend?: () => void
}

/** A recorded clip before it goes out: play it back, scrub, then Send. */
export const VoiceReviewRow = ({ draft, sending, onSend }: VoiceReviewRowProps) => {
    const isMobile = useIsMobile()
    // The clip plays through the shared player (keyed by its local URL): smooth fill, one sound at a time.
    const { playing, position } = useVoicePlayback(draft.url)
    const duration = draft.voice?.duration ?? draft.seconds
    const bars = draft.voice?.waveform ?? []
    const barCount = bars.length || WAVEFORM_BARS
    const failed = draft.upload.status === "failed"
    const buttonSize = isMobile ? "lg" : "sm"

    const togglePlayback = () => voicePlaybackStore.toggle(draft.url, draft.url)

    return (
        <>
            <DesktopTooltip label={playing ? _("Pause") : _("Play")}>
                <Button
                    variant="subtle"
                    size={buttonSize}
                    isIconButton
                    type="button"
                    className="rounded-full"
                    aria-label={playing ? _("Pause") : _("Play")}
                    onClick={togglePlayback}
                >
                    {playing ? <Pause /> : <Play />}
                </Button>
            </DesktopTooltip>
            <VoiceWaveform
                bars={bars}
                // Natural width: in a wide desktop row the 48 bars would otherwise spread far apart.
                className="max-w-60"
                // Whole bars only, so the bars re-render when one flips, not every frame.
                progress={duration > 0 ? Math.floor((position / duration) * barCount) / barCount : 0}
                label={_("Seek")}
                onSeek={(fraction) => voicePlaybackStore.seek(draft.url, fraction * duration)}
                onToggle={togglePlayback}
                onStep={(delta) => voicePlaybackStore.seekBy(draft.url, delta, duration)}
            />
            <span className="w-10 shrink-0 text-base md:text-sm tabular-nums text-ink-gray-5">
                {formatTime(playing || position > 0 ? Math.max(0, duration - position) : duration)}
            </span>
            {onSend && (
                <Button
                    variant="solid"
                    size={buttonSize}
                    isIconButton
                    type="button"
                    className="ms-auto rounded-full"
                    aria-label={failed ? _("Retry upload") : _("Send voice note")}
                    onClick={onSend}
                    loading={sending}
                >
                    {/* The composer's mobile Send icon */}
                    <SendHorizontalIcon />
                </Button>
            )}
        </>
    )
}
