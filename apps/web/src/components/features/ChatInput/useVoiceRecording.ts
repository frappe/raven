import { useCallback, useContext, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import { useAtom } from "jotai"
import { useIsMobile } from "@hooks/use-mobile"
import type { QuietSendMode } from "@hooks/useQuietHours"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { unlockAudioContext } from "@lib/audioContext"
import { randomUUID } from "@lib/uuid"
import { enqueueSend, type OutgoingFile } from "@stores/messages/messageSender"
import { voicePlaybackStore } from "@stores/voicePlayback/store"
import { replyToMessageAtom } from "@utils/channelAtoms"
import { hapticTick } from "@utils/haptics"
import { buildReplySnapshot } from "@utils/replySnapshot"
import type { VoiceComposerHandle, VoiceSendOptions } from "./VoiceComposer"

/** The composer's side of a voice note: opening the recorder (tap or hold), closing it, sending the note. */
export const useVoiceRecording = ({ channelID, editor, quietSendMode, stopTyping, covered }: {
    channelID: string
    editor: Editor | null
    quietSendMode: QuietSendMode
    stopTyping: () => void
    /** The composer is hidden under another layer: its Stop is out of reach. */
    covered: boolean
}) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { name: currentUser } = useUserCookieData()
    const [replyTo, setReplyTo] = useAtom(replyToMessageAtom(channelID))
    const isMobile = useIsMobile()
    const [recording, setRecording] = useState(false)
    // Covered mid-recording: unmounting the recorder discards the take and releases the mic.
    if (covered && recording) setRecording(false)
    const composerRef = useRef<VoiceComposerHandle>(null)
    // Desktop: where the recorder renders the composer's Send button while it's up.
    const [sendSlot, setSendSlot] = useState<HTMLElement | null>(null)

    // Runs inside the tap: iOS only lets audio start from a user gesture.
    const start = () => {
        unlockAudioContext()
        // The mic would record a voice note that's playing.
        voicePlaybackStore.pause()
        // Tap, hold or the sheet alike; before the mic opens, since iOS mutes haptics while recording.
        if (isMobile) hapticTick()
        setRecording(true)
    }

    // Mobile hold: records until the finger lifts. Listened on window, since the mic hides once recording starts.
    const startHold = () => {
        start()
        const lifted = new AbortController()
        const release = () => {
            lifted.abort()
            // Lifted before the recorder mounted: too short to be a hold, so it records like a tap.
            composerRef.current?.release()
        }
        // Touch events, not pointercancel: iOS can cancel the pointer of an element that hides mid-press.
        for (const type of ["touchend", "touchcancel", "pointerup"]) window.addEventListener(type, release, { signal: lifted.signal })
    }

    const close = () => {
        setRecording(false)
        // Next frame: the editor is hidden until this render lands, and hidden content can't take focus.
        if (!isMobile) requestAnimationFrame(() => editor?.commands.focus())
    }

    /** A voice note goes out alone: no text, the current reply, the quiet-hours default. */
    const send = useCallback((file: OutgoingFile, options?: VoiceSendOptions) => {
        enqueueSend(call, {
            channelID,
            batchId: randomUUID(),
            owner: currentUser,
            content: "",
            files: [file],
            linkedMessage: replyTo?.name,
            repliedMessageDetails: buildReplySnapshot(replyTo),
            sendSilently: options?.sendSilently ?? (quietSendMode === "auto" ? true : undefined),
        })
        if (replyTo) setReplyTo(null)
        stopTyping()
    }, [call, channelID, currentUser, replyTo, setReplyTo, quietSendMode, stopTyping])

    return { recording, start, startHold, close, send, composerRef, sendSlot, setSendSlot }
}
