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
import { selectedContacts } from "./shareSelection"
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
    const [contacts, setContacts] = useState<PickedContact[]>([])
    const [chooserOpen, setChooserOpen] = useState(false)
    const [sending, setSending] = useState(false)
    const sendingRef = useRef(false)
    // Cancel abandons only the photo uploads; once they finish, the sends go out even if the composer unmounts.
    const tokenRef = useRef<UploadToken | null>(null)
    const sendQueue = useRef<Promise<void>>(Promise.resolve())

    // One picker at a time: a double tap must not open it twice.
    const pickingRef = useRef(false)
    const choose = useCallback(async (field?: "phone" | "email") => {
        if (pickingRef.current) return
        pickingRef.current = true
        const result = await pickContact(field).finally(() => {
            pickingRef.current = false
        })
        if (result.status === "picked") setContacts([result.contact])
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

    /** Opens the sheet for contacts shared from another app. */
    const share = useCallback((shared: PickedContact[]) => {
        if (shared.length) setContacts(shared)
    }, [])

    // Closing while a photo uploads abandons it, so the uploaded file is deleted.
    const close = useCallback(() => {
        if (tokenRef.current) tokenRef.current.abandoned = true
        sendingRef.current = false
        setSending(false)
        setChooserOpen(false)
        setContacts([])
    }, [])

    const send = useCallback(async (allContacts: PickedContact[], ticked: Set<string>) => {
        if (sendingRef.current) return
        const selected = selectedContacts(allContacts, ticked)
        if (!selected.length) return
        sendingRef.current = true
        setSending(true)
        const token: UploadToken = { abandoned: false }
        tokenRef.current = token
        // Photos upload together (each capped at 5 s); the sends below stay one at a time.
        const uploads = await Promise.all(
            selected.map((contact) => {
                const photo = contact.photo
                if (!photo) return null
                return uploadFileWithin({
                    render: () => renderContactPhoto(photo),
                    upload: async (file) => {
                        const response = await fileApi.uploadFile(file, { doctype: "Raven Message", isPrivate: true })
                        return response.data.message
                    },
                    remove: (name) => db.deleteDoc("File", name),
                    ms: PHOTO_TIMEOUT_MS,
                    token,
                })
            }),
        )
        if (token.abandoned) {
            // Cancel came mid-upload: the photos that finished before it are this send's to delete.
            for (const uploaded of uploads) if (uploaded) void db.deleteDoc("File", uploaded.name).catch(() => { })
            return
        }
        // Uploads are done, so the sheet closes now; the sends carry on without it.
        sendingRef.current = false
        setSending(false)
        setContacts([])
        const reply = replyTo
        if (reply) clearReply()
        stopTyping()
        for (const [index, contact] of selected.entries()) {
            const uploaded = uploads[index]
            // One at a time, across sheets too: concurrent sends to a channel race on its last-message row.
            sendQueue.current = sendQueue.current.then(() =>
                enqueueSend(call, {
                    channelID,
                    batchId: randomUUID(),
                    owner: sessionUser().name,
                    content: "",
                    files: uploaded ? [uploaded.file] : [],
                    contact: { name: contact.name, phones: contact.phones, emails: contact.emails },
                    // The reply rides the first contact only.
                    linkedMessage: index === 0 ? reply?.name : undefined,
                    repliedMessageDetails: index === 0 ? buildReplySnapshot(reply) : undefined,
                    sendSilently: quietSendMode === "auto" ? true : undefined,
                }),
            )
        }
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
            {contacts.length > 0 && (
                <ShareContactSheet contacts={contacts} sending={sending} onClose={close} onSend={send} />
            )}
        </>
    )

    return { start, share, sheet }
}
