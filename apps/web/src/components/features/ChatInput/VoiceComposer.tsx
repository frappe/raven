import { useCallback, useImperativeHandle, useRef, type ReactNode, type Ref } from "react"
import { createPortal } from "react-dom"
import { Square, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@components/ui/button"
import { EDITOR_MIN_H } from "@components/features/editor/useRavenEditor"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import type { OutgoingFile } from "@stores/messages/messageSender"
import { voicePlaybackStore } from "@stores/voicePlayback/store"
import { hapticTick } from "@utils/haptics"
import { useVoiceDraft } from "./useVoiceDraft"
import { VoiceReviewRow } from "./VoiceReviewRow"
import { DesktopTooltip } from "./DesktopTooltip"
import { RecordingMeter } from "./RecordingMeter"
import { useVoiceRecorder, type RecordingEnd } from "./useVoiceRecorder"
import { MIN_RECORDING_MS, type MicErrorKind } from "./recordingFormat"

export type VoiceSendOptions = { sendSilently?: boolean }

/** What the composer's own Send button needs while the inline recorder is up. */
type VoiceSendControl = {
    /** Sends the reviewed clip, or stops the recording and sends it. */
    send: (options?: VoiceSendOptions) => void
    sending: boolean
    disabled: boolean
}

export type VoiceComposerHandle = {
    /** The hold that started the recording ended: stop it for review, unless it was too short to be a hold. */
    release: () => void
}

type VoiceComposerProps = {
    ref?: Ref<VoiceComposerHandle>
    onSend: (file: OutgoingFile, options?: VoiceSendOptions) => void
    onClose: () => void
} & (
        | { layout: "row" }
        | {
            layout: "inline"
            /** The toolbar's Send slot: the composer's Send button renders there, driven by the recorder. */
            sendSlot: HTMLElement | null
            renderSend: (control: VoiceSendControl) => ReactNode
        }
    )

/**
 * Record, Stop, review (play / scrub), then Send or Discard. Leaving at any point
 * throws the clip away. `row` replaces the mobile input row and carries its own Send;
 * `inline` takes the desktop editor's place and sends through the composer's Send button.
 */
export const VoiceComposer = (props: VoiceComposerProps) => {
    const { layout, onSend, onClose, ref } = props
    const isMobile = useIsMobile()
    const inline = layout === "inline"
    const { draft, sending, prepare, send, discard } = useVoiceDraft()
    // Send pressed while recording: sent as soon as the stopped clip is prepared.
    const sendOnFinish = useRef<VoiceSendOptions | null>(null)
    const rootRef = useRef<HTMLDivElement | null>(null)
    // Desktop: the recorder holds focus, so Enter sends and Esc discards.
    const focusOnMount = useCallback(
        (element: HTMLDivElement | null) => {
            rootRef.current = element
            if (element && inline) element.focus({ preventScroll: true })
        },
        [inline],
    )

    const deliver = (options?: VoiceSendOptions) => send((file) => onSend(file, options), () => onClose())

    const onFinish = (file: File | null, reason: RecordingEnd) => {
        if (reason === "limit") toast.info(_("Voice notes can be up to 10 minutes long"))
        if (!file) {
            // Stop or Send too soon after the mic opened.
            if (reason === "stopped" && isMobile) hapticTick("warning")
            return onClose()
        }
        // Stopped: the mic is already released, so iOS plays it.
        if (isMobile) hapticTick()
        // The recorder's length is the fallback duration if the browser can't decode the clip.
        prepare(file, meter.get().elapsed / 1000)
        const pending = sendOnFinish.current
        sendOnFinish.current = null
        if (pending) deliver(pending)
    }
    const onStartError = (error: MicErrorKind) => {
        if (error === "blocked") toast.error(_("Microphone access is blocked. Allow it in your browser or device settings."))
        else if (error === "missing") toast.error(_("No microphone found"))
        else if (error === "busy") toast.error(_("Microphone is in use by another app"))
        else toast.error(_("Could not start recording"))
        onClose()
    }
    const { status, meter, stop, cancel } = useVoiceRecorder(onFinish, onStartError)
    const live = status === "recording"

    const close = () => {
        // The review clip's URL is about to be revoked.
        if (draft) voicePlaybackStore.stop(draft.url)
        cancel()
        // After the mic is released: iOS mutes haptics while recording.
        if (isMobile) hapticTick("error")
        discard()
        onClose()
    }

    const sendVoice = (options?: VoiceSendOptions) => {
        if (draft) {
            voicePlaybackStore.stop(draft.url)
            deliver(options)
            return
        }
        if (!live) return
        sendOnFinish.current = options ?? {}
        stop()
    }

    const stopRecording = () => {
        stop()
        // Stop unmounts; keep focus in the recorder for Enter / Esc.
        if (inline) rootRef.current?.focus({ preventScroll: true })
    }

    useImperativeHandle(ref, () => ({
        release: () => {
            // Already stopped (e.g. the recording limit): the review stays.
            if (draft) return
            // Let go too soon: treated as a tap, so it keeps recording until Stop.
            if (!live || meter.get().elapsed < MIN_RECORDING_MS) return
            stop()
        },
    }))

    const buttonSize = isMobile ? "lg" : "sm"

    const controls = (
        <div
            className={cn(
                "flex items-center gap-2",
                // Desktop: the toolbar's side padding; top-aligned like the editor's first line.
                inline && "px-1 pt-2",
                // Mobile row: the input row's paddings, so Discard and Stop land where + and the mic were;
                // the home-indicator inset replaces the bottom padding (as on the input row), not adds to it.
                !inline && "ps-1 pe-2 py-2 max-md:standalone:pb-[max(var(--inset-bottom),0.75rem)] md:px-2 md:py-1.5",
            )}
        >
            <DesktopTooltip label={_("Discard")}>
                <Button variant="ghost" theme="red" size={buttonSize} isIconButton type="button" aria-label={_("Discard voice note")} disabled={sending} onClick={close}>
                    <Trash2 />
                </Button>
            </DesktopTooltip>
            {draft ? (
                <VoiceReviewRow
                    draft={draft}
                    sending={sending}
                    onSend={inline ? undefined : () => sendVoice()}
                />
            ) : (
                <>
                    <RecordingMeter meter={meter} live={live} compact={inline} />
                    <DesktopTooltip label={_("Stop recording")}>
                        <Button
                            // A tap before the mic is live does nothing.
                            variant={inline ? "subtle" : "solid"}
                            size={buttonSize}
                            isIconButton
                            type="button"
                            className={isMobile ? "rounded-full" : undefined}
                            aria-label={_("Stop recording")}
                            onClick={stopRecording}
                        >
                            <Square />
                        </Button>
                    </DesktopTooltip>
                </>
            )}
        </div>
    )

    return (
        <div
            ref={focusOnMount}
            tabIndex={inline ? -1 : undefined}
            className="outline-none"
            onKeyDown={(event) => {
                const target = event.target as Node
                // The toolbar's Send counts as the recorder; its menu (portaled elsewhere) handles its own keys.
                const fromSend = props.layout === "inline" && !!props.sendSlot?.contains(target)
                if (!event.currentTarget.contains(target) && !fromSend) return
                if (event.key === "Escape" && !sending) {
                    // Keep Esc from also closing whatever hosts the composer (e.g. the thread drawer).
                    event.stopPropagation()
                    close()
                }
                // On the recorder itself, not a focused button inside it.
                if (event.key === "Enter" && inline && event.target === event.currentTarget) {
                    event.preventDefault()
                    sendVoice()
                }
            }}
        >
            {/* Desktop: the editor's height, so the composer doesn't resize */}
            {inline ? <div className={EDITOR_MIN_H}>{controls}</div> : controls}
            {props.layout === "inline" &&
                props.sendSlot &&
                createPortal(props.renderSend({ send: sendVoice, sending, disabled: !draft && !live }), props.sendSlot)}
        </div>
    )
}
