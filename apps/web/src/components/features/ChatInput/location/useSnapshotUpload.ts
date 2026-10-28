import { withTimeout, type Snapshot } from "./snapshot"

export type UploadToken = { abandoned: boolean }
type UploadedFile = { name: string; file_url: string; file_size?: number }

export type UploadedSnapshot = { snapshot: Snapshot; name: string }

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
}: SnapshotUploadSteps): Promise<UploadedSnapshot | null> => {
    let timedOut = false
    const uploadFile = async (): Promise<UploadedSnapshot | null> => {
        const file = await render()
        if (!file || timedOut || token.abandoned) return null
        const uploaded = await upload(file)
        if (timedOut || token.abandoned) {
            void remove(uploaded.name).catch(() => {})
            return null
        }
        return {
            snapshot: { file_url: uploaded.file_url, file_size: uploaded.file_size ?? file.size },
            name: uploaded.name,
        }
    }
    const snapshot = await withTimeout(uploadFile(), ms)
    if (snapshot === null) timedOut = true
    return snapshot
}
