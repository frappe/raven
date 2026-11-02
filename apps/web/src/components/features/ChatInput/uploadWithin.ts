export type FileRef = { file_url: string; file_size: number }
export type UploadToken = { abandoned: boolean }
type UploadResponse = { name: string; file_url: string; file_size?: number }

export type TimedUpload = { file: FileRef; name: string }

/** `promise`'s value, or null once `ms` passes; rejections become null too. */
export const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
    new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms)
        promise.then(
            (value) => {
                clearTimeout(timer)
                resolve(value)
            },
            () => {
                clearTimeout(timer)
                resolve(null)
            },
        )
    })

type UploadSteps = {
    render: () => Promise<File | null>
    upload: (file: File) => Promise<UploadResponse>
    remove: (name: string) => Promise<unknown>
    ms: number
    token: UploadToken
}

/** Renders and uploads under `ms`; a late upload or an abandoned token deletes the file. */
export const uploadFileWithin = async ({
    render,
    upload,
    remove,
    ms,
    token,
}: UploadSteps): Promise<TimedUpload | null> => {
    let timedOut = false
    const uploadFile = async (): Promise<TimedUpload | null> => {
        const file = await render()
        if (!file || timedOut || token.abandoned) return null
        const uploaded = await upload(file)
        if (timedOut || token.abandoned) {
            void remove(uploaded.name).catch(() => {})
            return null
        }
        return {
            file: { file_url: uploaded.file_url, file_size: uploaded.file_size ?? file.size },
            name: uploaded.name,
        }
    }
    const result = await withTimeout(uploadFile(), ms)
    if (result === null) timedOut = true
    return result
}
