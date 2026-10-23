import { useMemo } from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@components/ui/button"
import { fileSrc } from "@hooks/useFileSrc"
import { WAVEFORM_BARS, parseVoiceJson } from "@lib/voiceNote"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { voicePlaybackStore } from "@stores/voicePlayback/store"
import { useVoicePlayback } from "@stores/voicePlayback/useVoicePlayback"
import { formatTime } from "./AudioPlayer"
import { MessageAudio } from "./MessageAudio"
import { VoiceWaveform } from "./VoiceWaveform"

/** A Voice message: 48 px card, fixed height so the stream reserves it up front. */
export const MessageVoiceNote = ({ message }: { message: Message }) => {
    const { playing, position, error, speed, showSpeed } = useVoicePlayback(message.name)
    // Parsed once per payload: the card re-renders ~4×/s while playing.
    const voice = useMemo(() => parseVoiceJson(message.json), [message.json])
    const file = (message as Message & { file?: string }).file
    // Unreadable payload: still playable as a plain audio file.
    if (!voice || !file) return <MessageAudio messages={[message]} />

    const toggle = () => voicePlaybackStore.toggle(message.name, fileSrc(file), message.channel_id)
    const remaining = Math.max(0, voice.duration - position)
    const barCount = voice.waveform.length || WAVEFORM_BARS

    return (
        <div data-message-id={message.name} data-media-root="" className="flex h-12 w-full max-w-[340px] items-center gap-2.5 rounded-xl border border-outline-gray-2 bg-surface-base pe-2.5 ps-2">
            <Button
                variant={playing ? "solid" : "subtle"}
                size="md"
                isIconButton
                type="button"
                className="rounded-full"
                aria-label={playing ? _("Pause") : _("Play")}
                onClick={toggle}
            >
                {playing ? <Pause /> : <Play />}
            </Button>
            <VoiceWaveform
                bars={voice.waveform}
                // Whole bars only, so the 48 bars re-render when one flips, not on every tick.
                progress={Math.floor((position / voice.duration) * barCount) / barCount}
                label={_("Seek")}
                onSeek={(fraction) => voicePlaybackStore.seek(message.name, fraction * voice.duration, message.channel_id)}
                onToggle={toggle}
                onStep={(delta) => voicePlaybackStore.seekBy(message.name, delta, voice.duration, message.channel_id)}
            />
            {error ? (
                <span className="shrink-0 text-base md:text-sm text-ink-gray-5">{_("Couldn't play")}</span>
            ) : (
                <span className="w-9 shrink-0 text-right text-base md:text-sm tabular-nums text-ink-gray-5">
                    {formatTime(playing || position > 0 ? remaining : voice.duration)}
                </span>
            )}
            {showSpeed && (
                <Button
                    variant="subtle"
                    size="xs"
                    type="button"
                    className="shrink-0 rounded-full tabular-nums"
                    aria-label={_("Playback speed")}
                    onClick={() => voicePlaybackStore.cycleSpeed()}
                >
                    {speed}×
                </Button>
            )}
        </div>
    )
}
