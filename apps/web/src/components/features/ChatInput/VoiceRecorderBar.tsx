import { useEffect, useRef, useState } from "react"
import { Square, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useResizeObserver } from "usehooks-ts"
import { Button } from "@components/ui/button"
import { formatTime } from "@components/features/message/renderers/AudioPlayer"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { useAttachFile } from "./useFileInput"
import { measureVoiceNote } from "./measureVoiceNote"
import { useVoiceRecorder, type RecordingEnd } from "./useVoiceRecorder"

// w-1 bar + gap-0.5
const BAR_PITCH_PX = 6

/**
 * Stands in for the composer row while recording. Stop attaches the clip to the
 * file strip; discard, Esc, or leaving the channel throws it away.
 */
export const VoiceRecorderBar = ({ channelID, onClose }: { channelID: string; onClose: (attached: boolean) => void }) => {
    const isMobile = useIsMobile()
    const attach = useAttachFile(channelID)
    const stopRef = useRef<HTMLButtonElement>(null)
    const meterRef = useRef<HTMLDivElement>(null)
    const { width: meterWidth = 0 } = useResizeObserver({ ref: meterRef as React.RefObject<HTMLElement> })
    // Between Stop and attach: the clip is decoded for its waveform.
    const [preparing, setPreparing] = useState(false)

    const onFinish = async (file: File | null, reason: RecordingEnd) => {
        if (reason === "limit") toast.info(_("Voice notes can be up to 10 minutes long"))
        if (!file) return onClose(false)
        setPreparing(true)
        // A failed decode still attaches the clip; it renders as a plain audio file.
        const voiceNote = await measureVoiceNote(file)
        attach([file], voiceNote ? { voiceNote } : undefined)
        onClose(true)
    }

    const { status, elapsed, levels, start, stop, cancel } = useVoiceRecorder(onFinish)

    useEffect(() => {
        start().then((error) => {
            if (!error) return
            if (error === "blocked") toast.error(_("Microphone access is blocked. Allow it in your browser or device settings."))
            else if (error === "missing") toast.error(_("No microphone found"))
            else if (error === "busy") toast.error(_("Microphone is in use by another app"))
            else toast.error(_("Could not start recording"))
            onClose(false)
        })
    }, [])

    // Stop starts disabled, so autoFocus can't land; focus it once recording begins.
    useEffect(() => {
        if (status === "recording" && !isMobile) stopRef.current?.focus()
    }, [status, isMobile])

    const discard = () => {
        cancel()
        onClose(false)
    }

    return (
        <div
            className="flex items-center gap-2 px-2 py-2 md:py-1.5"
            onKeyDown={(event) => {
                if (event.key !== "Escape" || preparing) return
                // Keep Esc from also closing whatever hosts the composer (e.g. the thread drawer).
                event.stopPropagation()
                discard()
            }}
        >
            <Button variant="ghost" theme="red" size={isMobile ? "lg" : "sm"} isIconButton type="button" aria-label={_("Discard voice note")} disabled={preparing} onClick={discard}>
                <Trash2 />
            </Button>
            {status === "recording" && (
                <>
                    <span className="size-2 shrink-0 rounded-full bg-surface-red-6 animate-pulse" />
                    <span className="w-10 shrink-0 text-base md:text-sm tabular-nums text-ink-gray-8">{formatTime(elapsed / 1000)}</span>
                </>
            )}
            {/* Always mounted so the resize observer has it from the first render */}
            <div ref={meterRef} className="flex h-6 min-w-0 flex-1 items-center gap-0.5 overflow-hidden" aria-hidden={status === "recording"}>
                {status === "recording" ? (
                    // Newest on the right: show only the bars that fit
                    levels.slice(Math.max(0, levels.length - Math.floor(meterWidth / BAR_PITCH_PX))).map((level, index) => (
                        <span key={index} className="w-1 shrink-0 rounded-full bg-ink-gray-5" style={{ height: `${Math.max(12, level * 100)}%` }} />
                    ))
                ) : (
                    <span className="text-base md:text-sm text-ink-gray-5">
                        {preparing ? _("Preparing voice note…") : _("Requesting microphone…")}
                    </span>
                )}
            </div>
            <Button
                ref={stopRef}
                variant="solid"
                size={isMobile ? "lg" : "sm"}
                isIconButton
                type="button"
                aria-label={_("Stop recording")}
                disabled={status !== "recording"}
                onClick={stop}
            >
                <Square />
            </Button>
        </div>
    )
}
