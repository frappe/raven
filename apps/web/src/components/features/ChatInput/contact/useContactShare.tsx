import { useCallback, useContext, useRef, useState } from "react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import type { Message } from "@raven/types/common/Message"
import type { QuietSendMode } from "@hooks/useQuietHours"
import { toast } from "sonner"
import { sessionUser } from "@lib/sessionUser"
import _ from "@lib/translate"
import { randomUUID } from "@lib/uuid"
import { enqueueSend } from "@stores/messages/messageSender"
import { buildReplySnapshot } from "@utils/replySnapshot"
import { needsFieldChoice, pickContact, type PickedContact } from "../../../../native/contacts"
import { ContactFieldChooser } from "./ContactFieldChooser"
import { ShareContactSheet } from "./ShareContactSheet"
import { selectedContact } from "./shareSelection"
import { renderContactPhoto } from "./contactPhoto"
import { uploadFileWithin, type TimedUpload, type UploadToken } from "../uploadWithin"

const PHOTO_TIMEOUT_MS = 5000

type ContactShareOptions = {
    channelID: string
    quietSendMode: QuietSendMode
    stopTyping: () => void
    replyTo: Message | null
    clearReply: () => void
}

/** The composer's contact picker: the field chooser, the share sheet, and the send. */
export const useContactShare = ({ channelID, quietSendMode, stopTyping, replyTo, clearReply }: ContactShareOptions) => {
    const { call, file: fileApi, db } = useContext(FrappeContext) as FrappeConfig
    const [picked, setPicked] = useState<PickedContact | null>(null)
    const [chooserOpen, setChooserOpen] = useState(false)
    const [sending, setSending] = useState(false)
    const sendingRef = useRef(false)
    // Only Cancel abandons a send; once Send is tapped it finishes even if the composer unmounts.
    const tokenRef = useRef<UploadToken | null>(null)

    // One picker at a time: a double tap must not open it twice.
    const pickingRef = useRef(false)
    const choose = useCallback(async (field?: "phone" | "email") => {
        if (pickingRef.current) return
        pickingRef.current = true
        const result = await pickContact(field).finally(() => {
            pickingRef.current = false
        })
        if (result.status === "picked") setPicked(result.contact)
        else if (result.status === "empty")
            toast.error(
                result.name
                    ? _("{0} has no phone number or email to share", [result.name])
                    : _("This contact has no phone number or email to share"),
            )
        else if (result.status === "failed") toast.error(_("Couldn't open your contacts. Try again."))
    }, [])

    const start = useCallback(() => {
        if (needsFieldChoice()) setChooserOpen(true)
        else void choose()
    }, [choose])

    // Closing while a photo uploads abandons it, so the uploaded file is deleted.
    const close = useCallback(() => {
        if (tokenRef.current) tokenRef.current.abandoned = true
        sendingRef.current = false
        setSending(false)
        setChooserOpen(false)
        setPicked(null)
    }, [])

    const send = useCallback(async (contact: PickedContact, ticked: Set<string>) => {
        if (sendingRef.current) return
        sendingRef.current = true
        setSending(true)
        const token: UploadToken = { abandoned: false }
        tokenRef.current = token
        let uploaded: TimedUpload | null = null
        if (contact.photo) {
            const photo = contact.photo
            uploaded = await uploadFileWithin({
                render: () => renderContactPhoto(photo),
                upload: async (file) => {
                    const response = await fileApi.uploadFile(file, { doctype: "Raven Message", isPrivate: true })
                    return response.data.message
                },
                remove: (name) => db.deleteDoc("File", name),
                ms: PHOTO_TIMEOUT_MS,
                token,
            })
        }
        // Cancel already reset the sheet; uploadFileWithin deleted any late upload.
        if (token.abandoned) return
        enqueueSend(call, {
            channelID,
            batchId: randomUUID(),
            owner: sessionUser().name,
            content: "",
            files: uploaded ? [uploaded.file] : [],
            contact: selectedContact(contact, ticked),
            linkedMessage: replyTo?.name,
            repliedMessageDetails: buildReplySnapshot(replyTo),
            sendSilently: quietSendMode === "auto" ? true : undefined,
        })
        if (replyTo) clearReply()
        stopTyping()
        sendingRef.current = false
        setSending(false)
        setPicked(null)
    }, [call, channelID, fileApi, db, replyTo, clearReply, quietSendMode, stopTyping])

    const sheet = (
        <>
            {chooserOpen && (
                <ContactFieldChooser
                    onClose={close}
                    onChoose={(field) => {
                        setChooserOpen(false)
                        void choose(field)
                    }}
                />
            )}
            {picked && <ShareContactSheet contact={picked} sending={sending} onClose={close} onSend={send} />}
        </>
    )

    return { start, sheet }
}
