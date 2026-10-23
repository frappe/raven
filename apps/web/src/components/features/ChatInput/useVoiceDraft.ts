import { useContext, useEffect, useRef, useState } from "react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import type { VoiceNoteMeta } from "@lib/voiceNote"
import _ from "@lib/translate"
import type { OutgoingFile } from "@stores/messages/messageSender"
import { measureVoiceNote } from "./measureVoiceNote"

type Uploaded = { status: "uploaded"; fileID: string; fileURL: string; fileSize: number }

export type VoiceUpload = { status: "uploading" } | Uploaded | { status: "failed" }

export type VoiceDraft = {
    file: File
    /** Object URL for local review playback. */
    url: string
    /** undefined while measuring; null when the browser couldn't decode the clip. */
    voice: VoiceNoteMeta | null | undefined
    /** Recorder's elapsed time, the fallback length when decoding fails. */
    seconds: number
    upload: VoiceUpload
}

const toOutgoing = (draft: VoiceDraft, uploaded: Uploaded): OutgoingFile => ({
    file_url: uploaded.fileURL,
    file_size: uploaded.fileSize,
    ...(draft.voice ? { voice: draft.voice } : {}),
})

/**
 * A recorded clip between Stop and Send: measures it and uploads it in the
 * background. Send waits for the upload — even after the composer is gone — while
 * a discarded or abandoned clip has its upload deleted.
 */
export const useVoiceDraft = () => {
    const { file: fileApi, db } = useContext(FrappeContext) as FrappeConfig
    const [draft, setDraft] = useState<VoiceDraft | null>(null)
    const [sending, setSending] = useState(false)
    const draftRef = useRef(draft)
    draftRef.current = draft
    // Send pressed before the upload landed: delivered when it does.
    const pendingSend = useRef<{ deliver: (file: OutgoingFile) => void; onSent: () => void } | null>(null)
    const mounted = useRef(true)
    // Clips whose upload must be deleted once it lands (discarded, or composer gone).
    const abandoned = useRef(new WeakSet<File>())

    const patch = (file: File, change: Partial<VoiceDraft>) =>
        setDraft((current) => (current && current.file === file ? { ...current, ...change } : current))

    const release = (current: VoiceDraft, deleteUpload: boolean) => {
        URL.revokeObjectURL(current.url)
        if (!deleteUpload) return
        if (current.upload.status === "uploaded") void db.deleteDoc("File", current.upload.fileID)
        else abandoned.current.add(current.file)
    }

    // Clear the ref now: the composer may unmount before the next render, and its
    // cleanup must not delete (or re-release) a clip already sent or discarded.
    const finishWith = (deleteUpload: boolean) => {
        if (draftRef.current) release(draftRef.current, deleteUpload)
        draftRef.current = null
        pendingSend.current = null
        setDraft(null)
        setSending(false)
    }

    const upload = (file: File) => {
        patch(file, { upload: { status: "uploading" } })
        fileApi
            .uploadFile(file, { doctype: "Raven Message", isPrivate: true })
            .then((res) => {
                const uploaded: Uploaded = { status: "uploaded", fileID: res.data.message.name, fileURL: res.data.message.file_url, fileSize: res.data.message.file_size ?? file.size }
                if (abandoned.current.has(file)) {
                    void db.deleteDoc("File", uploaded.fileID)
                    return
                }
                const current = draftRef.current
                const pending = pendingSend.current
                if (pending && current?.file === file) {
                    pending.deliver(toOutgoing(current, uploaded))
                    finishWith(false)
                    if (mounted.current) pending.onSent()
                    return
                }
                patch(file, { upload: uploaded })
            })
            .catch(() => {
                const wasSending = !!pendingSend.current
                pendingSend.current = null
                if (!mounted.current) {
                    if (wasSending) toast.error(_("Your voice note couldn't be sent"))
                    if (draftRef.current?.file === file) URL.revokeObjectURL(draftRef.current.url)
                    return
                }
                setSending(false)
                patch(file, { upload: { status: "failed" } })
            })
    }

    const prepare = (file: File, seconds: number) => {
        setDraft({ file, url: URL.createObjectURL(file), voice: undefined, seconds, upload: { status: "uploading" } })
        upload(file)
        void measureVoiceNote(file).then((voice) => patch(file, { voice }))
    }

    /**
     * Send now if uploaded; otherwise once the upload lands (a failed one is retried).
     * `onSent` runs only if the composer is still on screen by then.
     */
    const send = (deliver: (file: OutgoingFile) => void, onSent: () => void) => {
        const current = draftRef.current
        if (!current || pendingSend.current) return
        if (current.upload.status === "uploaded") {
            deliver(toOutgoing(current, current.upload))
            finishWith(false)
            onSent()
            return
        }
        pendingSend.current = { deliver, onSent }
        setSending(true)
        if (current.upload.status === "failed") upload(current.file)
    }

    const discard = () => finishWith(true)

    // Leaving abandons an unsent clip; one already sent on its way finishes on its own.
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            if (draftRef.current && !pendingSend.current) release(draftRef.current, true)
        }
    }, [])

    return { draft, sending, prepare, send, discard }
}
