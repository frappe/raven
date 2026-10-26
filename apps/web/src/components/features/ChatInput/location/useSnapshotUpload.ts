import { useCallback, useContext, useLayoutEffect, useRef } from "react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import type { LocationMeta } from "@lib/location"
import { SNAPSHOT_TIMEOUT_MS, renderLocationSnapshot, withTimeout, type Snapshot } from "./snapshot"

type UploadToken = { abandoned: boolean }
type UploadedFile = { name: string; file_url: string; file_size?: number }

type SnapshotUploadSteps = {
    render: () => Promise<File | null>
    upload: (file: File) => Promise<UploadedFile>
    remove: (name: string) => Promise<unknown>
    ms: number
    token: UploadToken
}

/** Renders and uploads under `ms`; a late upload or an abandoned token deletes the file. */
export const uploadSnapshotWithin = async ({
    render,
    upload,
    remove,
    ms,
    token,
}: SnapshotUploadSteps): Promise<Snapshot | null> => {
    const uploadFile = async (): Promise<Snapshot | null> => {
        const file = await render()
        if (!file || token.abandoned) return null
        const uploaded = await upload(file)
        if (token.abandoned) {
            void remove(uploaded.name).catch(() => {})
            return null
        }
        return { file_url: uploaded.file_url, file_size: uploaded.file_size ?? file.size }
    }
    const snapshot = await withTimeout(uploadFile(), ms)
    if (snapshot === null) token.abandoned = true
    return snapshot
}

/** Renders and uploads the snapshot under a 5 s cap; a late or discarded upload is deleted. */
export const useSnapshotUpload = () => {
    const { file: fileApi, db } = useContext(FrappeContext) as FrappeConfig
    const tokens = useRef(new Set<UploadToken>())

    useLayoutEffect(() => {
        const active = tokens.current
        return () => {
            active.forEach((token) => {
                token.abandoned = true
            })
        }
    }, [])

    return useCallback(
        async (meta: LocationMeta, zoom: number): Promise<Snapshot | null> => {
            const token: UploadToken = { abandoned: false }
            tokens.current.add(token)
            const snapshot = await uploadSnapshotWithin({
                render: () => renderLocationSnapshot(meta, zoom),
                upload: async (file) => {
                    const response = await fileApi.uploadFile(file, { doctype: "Raven Message", isPrivate: true })
                    return response.data.message
                },
                remove: (name) => db.deleteDoc("File", name),
                ms: SNAPSHOT_TIMEOUT_MS,
                token,
            })
            tokens.current.delete(token)
            return snapshot
        },
        [fileApi, db],
    )
}
