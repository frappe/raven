import { useCallback, useContext, useState } from "react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import type { Message } from "@raven/types/common/Message"
import type { QuietSendMode } from "@hooks/useQuietHours"
import { senderMapsUrl, type LocationMeta } from "@lib/location"
import { siteSupportsLocationMessages } from "@lib/locationSupport"
import { sessionUser } from "@lib/sessionUser"
import { randomUUID } from "@lib/uuid"
import { enqueueSend } from "@stores/messages/messageSender"
import { escapeHtml } from "@utils/htmlUtils"
import { buildReplySnapshot } from "@utils/replySnapshot"
import type { Snapshot } from "./snapshot"

/** The link an older site shows in place of a Location message. */
export const locationFallbackHtml = (meta: LocationMeta): string => {
    const url = escapeHtml(senderMapsUrl(meta))
    return `<p><a href="${url}">${url}</a></p>`
}

/** The composer's location picker: open state and the send, mirroring a voice note's. */
export const useLocationShare = ({ channelID, quietSendMode, stopTyping, replyTo, clearReply }: {
    channelID: string
    quietSendMode: QuietSendMode
    stopTyping: () => void
    replyTo: Message | null
    clearReply: () => void
}) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const [open, setOpen] = useState(false)
    const openPicker = useCallback(() => setOpen(true), [])

    /** A location goes out alone: its coordinates and snapshot, the current reply, quiet hours. */
    const send = useCallback((location: LocationMeta, snapshot: Snapshot | null) => {
        const supported = siteSupportsLocationMessages()
        enqueueSend(call, {
            channelID,
            batchId: randomUUID(),
            owner: sessionUser().name,
            content: supported ? "" : locationFallbackHtml(location),
            files: snapshot ? [snapshot] : [],
            linkedMessage: replyTo?.name,
            repliedMessageDetails: buildReplySnapshot(replyTo),
            sendSilently: quietSendMode === "auto" ? true : undefined,
            ...(supported ? { location } : {}),
        })
        if (replyTo) clearReply()
        stopTyping()
    }, [call, channelID, replyTo, clearReply, quietSendMode, stopTyping])

    return { open, setOpen, openPicker, send }
}
