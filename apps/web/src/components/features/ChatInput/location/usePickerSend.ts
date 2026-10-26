import { useLayoutEffect, useRef, useState } from "react"
import type { LocationMeta } from "@lib/location"
import { siteSupportsLocationMessages } from "@lib/locationSupport"
import type { Snapshot } from "./snapshot"
import { useSnapshotUpload } from "./useSnapshotUpload"

type PickerSendOptions = {
    onSend: (location: LocationMeta, snapshot: Snapshot | null) => void
    onClose: () => void
    getLocation: () => LocationMeta | null
    getZoom: () => number
}

/** The picker's send flow: uploads a snapshot, then hands the location over. */
export const usePickerSend = ({ onSend, onClose, getLocation, getZoom }: PickerSendOptions) => {
    const uploadSnapshot = useSnapshotUpload()
    const [sending, setSending] = useState(false)
    const sendingRef = useRef(false)
    const cancelledRef = useRef(false)

    useLayoutEffect(() => {
        cancelledRef.current = false
        return () => {
            cancelledRef.current = true
        }
    }, [])

    const send = async () => {
        const location = getLocation()
        if (!location || sendingRef.current) return
        sendingRef.current = true
        setSending(true)
        // Read the map at send time: a pan may still be in flight.
        const zoom = getZoom()
        // An older site sends a plain link, so the snapshot step is skipped.
        const snapshot = siteSupportsLocationMessages() ? await uploadSnapshot(location, zoom) : null
        if (cancelledRef.current) return
        onSend(location, snapshot)
        onClose()
    }

    return { send, sending }
}
