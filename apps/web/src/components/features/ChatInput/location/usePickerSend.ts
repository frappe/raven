import { useContext, useLayoutEffect, useRef, useState } from "react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import type { LocationMeta } from "@lib/location"
import { siteHasFeature } from "../../../../native/platform"
import { SNAPSHOT_TIMEOUT_MS, renderLocationSnapshot, type Snapshot } from "./snapshot"
import { uploadSnapshotWithin, type UploadToken, type UploadedSnapshot } from "./useSnapshotUpload"

type PickerSendOptions = {
    onSend: (location: LocationMeta, snapshot: Snapshot | null) => void
    onClose: () => void
    getLocation: () => LocationMeta | null
    getZoom: () => number
}

/** The picker's send flow: uploads a snapshot, then hands the location over. */
export const usePickerSend = ({ onSend, onClose, getLocation, getZoom }: PickerSendOptions) => {
    const { file: fileApi, db } = useContext(FrappeContext) as FrappeConfig
    const [sending, setSending] = useState(false)
    const sendingRef = useRef(false)
    const tokenRef = useRef<UploadToken | null>(null)

    useLayoutEffect(() => {
        return () => {
            if (tokenRef.current) tokenRef.current.abandoned = true
        }
    }, [])

    const send = async () => {
        const location = getLocation()
        if (!location || sendingRef.current) return
        sendingRef.current = true
        setSending(true)
        // Read the map at send time: a pan may still be in flight.
        const zoom = getZoom()
        // Tokens are per send, so StrictMode's remount can't cancel a later send.
        const token: UploadToken = { abandoned: false }
        tokenRef.current = token
        // An older site sends a plain link, so the snapshot step is skipped.
        let uploaded: UploadedSnapshot | null = null
        if (siteHasFeature("location_messages")) {
            uploaded = await uploadSnapshotWithin({
                render: () => renderLocationSnapshot(location, zoom),
                upload: async (file) => {
                    const response = await fileApi.uploadFile(file, { doctype: "Raven Message", isPrivate: true })
                    return response.data.message
                },
                remove: (name) => db.deleteDoc("File", name),
                ms: SNAPSHOT_TIMEOUT_MS,
                token,
            })
        }
        if (token.abandoned) {
            if (uploaded) void db.deleteDoc("File", uploaded.name).catch(() => {})
            return
        }
        onSend(location, uploaded?.snapshot ?? null)
        onClose()
    }

    return { send, sending }
}
