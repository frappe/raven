import { useEffect, useRef } from "react"
import { Square, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useResizeObserver } from "usehooks-ts"
import { Button } from "@components/ui/button"
import { formatTime } from "@components/features/message/renderers/AudioPlayer"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import type { OutgoingFile } from "@stores/messages/messageSender"
import { useVoiceDraft } from "./useVoiceDraft"
import { VoiceReviewRow } from "./VoiceReviewRow"
import { useVoiceRecorder, type RecordingEnd } from "./useVoiceRecorder"

// w-1 bar + gap-0.5
const BAR_PITCH_PX = 6

/**
 * Stands in for the composer row: record, Stop, review (play / scrub), then Send
 * or Discard. Leaving at any point throws the clip away.
 */
export const VoiceComposer = ({ onSend, onClose }: { onSend: (file: OutgoingFile) => void; onClose: (sent: boolean) => void }) => {
    const isMobile = useIsMobile()
    const meterRef = useRef<HTMLDivElement>(null)
    const stopRef = useRef<HTMLButtonElement>(null)
    const { width: meterWidth = 0 } = useResizeObserver({ ref: meterRef as React.RefObject<HTMLElement> })
    const { draft, sending, prepare, send, discard } = useVoiceDraft()
    // Stop's clip length, the fallback duration if the browser can't decode it.
    const elapsedRef = useRef(0)

    const onFinish = (file: File | null, reason: RecordingEnd) => {
        if (reason === "limit") toast.info(_("Voice notes can be up to 10 minutes long"))
        if (!file) return onClose(false)
        prepare(file, elapsedRef.current / 1000)
    }
    const { status, elapsed, levels, start, stop, cancel } = useVoiceRecorder(onFinish)
    elapsedRef.current = elapsed

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

    const reviewing = !!draft && draft.voice !== undefined
    // Desktop: focus Stop so Enter / Esc work without the mouse (review focuses Send itself).
    useEffect(() => {
        if (!isMobile && status === "recording") stopRef.current?.focus()
    }, [status, isMobile])

    const close = () => {
        cancel()
        discard()
        onClose(false)
    }

    const buttonSize = isMobile ? "lg" : "sm"

    return (
        <div
            className="flex items-center gap-2 px-2 py-2 md:py-1.5"
            onKeyDown={(event) => {
                if (event.key !== "Escape" || (draft && !reviewing) || sending) return
                // Keep Esc from also closing whatever hosts the composer (e.g. the thread drawer).
                event.stopPropagation()
                close()
            }}
        >
            <Button variant="ghost" theme="red" size={buttonSize} isIconButton type="button" aria-label={_("Discard voice note")} disabled={(!!draft && !reviewing) || sending} onClick={close}>
                <Trash2 />
            </Button>

            {reviewing && draft ? (
                <VoiceReviewRow draft={draft} sending={sending} onSend={() => send(onSend, () => onClose(true))} />
            ) : (
                <>
                    {status === "recording" && !draft && (
                        <>
                            <span className="size-2 shrink-0 rounded-full bg-surface-red-6 animate-pulse" />
                            <span className="w-10 shrink-0 text-base md:text-sm tabular-nums text-ink-gray-8">{formatTime(elapsed / 1000)}</span>
                        </>
                    )}
                    {/* Always mounted so the resize observer has it from the first render */}
                    <div ref={meterRef} className="flex h-6 min-w-0 flex-1 items-center gap-0.5 overflow-hidden" aria-hidden={status === "recording"}>
                        {status === "recording" && !draft ? (
                            // Newest on the right: show only the bars that fit
                            levels.slice(Math.max(0, levels.length - Math.floor(meterWidth / BAR_PITCH_PX))).map((level, index) => (
                                <span key={index} className="w-1 shrink-0 rounded-full bg-ink-gray-5" style={{ height: `${Math.max(12, level * 100)}%` }} />
                            ))
                        ) : (
                            <span className="text-base md:text-sm text-ink-gray-5">
                                {draft ? _("Preparing voice note…") : _("Requesting microphone…")}
                            </span>
                        )}
                    </div>
                    <Button
                        ref={stopRef}
                        variant="solid"
                        size={buttonSize}
                        isIconButton
                        type="button"
                        className={isMobile ? "rounded-full" : undefined}
                        aria-label={_("Stop recording")}
                        disabled={status !== "recording" || !!draft}
                        onClick={stop}
                    >
                        <Square />
                    </Button>
                </>
            )}
        </div>
    )
}
