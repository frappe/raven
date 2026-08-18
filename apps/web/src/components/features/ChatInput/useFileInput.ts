import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai-family'
import { atom, getDefaultStore, useSetAtom } from 'jotai'
import { FrappeConfig, FrappeContext, useFrappeDeleteDoc } from 'frappe-react-sdk'
import { useContext } from 'react'
import { toast } from 'sonner'
import { formatBytes, getFileExtension } from '@raven/lib/utils/operations'
import { randomUUID } from '@lib/uuid'
import { measureMediaDimensions } from '@lib/mediaDimensions'
import _ from '@lib/translate'

/**
 * 
 * For file uploads, we need to consider a few scenarios:
 * 
 * 1. User selects multiple files, but then hits the send button. Some files were uploaded, some were still inflight.
 * In such a case, we hold the send (pendingSendAtom) and dispatch it once every upload settles.
 *
 * 2. User selects a file and it's being uploaded but the user then closes the tab - in this case we lose the file (acceptable)
 * 3. User selects a file and it's being uploaded - the user can switch channels when the file is being uploaded and resume once back
 * 4. User selects a file and it's uploaded - then the user refreshes the tab - the user should still see the file in the chat input.
 * 
 * To cater to the above:
 *
 * 1. Maintain a local state for all files that are being uploaded (uploadingFilesAtom) (3)
 * 2. Maintain a local state for all files that are uploaded (uploadedFilesAtom) - which is persisted in local storage (4)
 * 3. When a file finishes uploading, move it from uploadingFilesAtom to uploadedFilesAtom (1)
 * 4. The send is held (pendingSendAtom) while anything is still uploading; ChatInput
 *    watches uploadingFilesAtom and dispatches the held send once every upload settles (1)
 *
 */

export interface QueuedFileType {
    /** The file object picked by the user */
    file: File,
    /** Upload progress */
    uploadProgress?: number,
    status: 'uploading' | 'error',
    /** Frontend generated ID */
    id: string,
    /** Name of the file */
    fileName: string,
    /** Size of the file in bytes */
    size: number,
    /** When the file was uploaded in milliseconds */
    timestamp: number
}

export interface UploadedFile {
    /** File ID returned from the server */
    fileID: string
    /** File URL returned from the server */
    fileURL: string,
    /** Frontend generated ID */
    id: string,
    /** Name of the file */
    fileName: string,
    /** Size of the file in bytes */
    size: number,
    /** When the file was uploaded in milliseconds */
    timestamp: number
    /** Display size, measured in-browser for videos and images (see
     *  measureMediaDimensions) — rides the send so the message and its
     *  optimistic placeholder reserve the box up front. */
    width?: number
    height?: number
}



/** Atom to track files that are being uploaded per channel */
export const uploadingFilesAtom = atomFamily((_channelID: string) => atom<QueuedFileType[]>([]))

/** Atom to track files that are uploaded per channel */
export const uploadedFilesAtom = atomFamily((channelID: string) => atomWithStorage<UploadedFile[]>(`uploaded-files-${channelID}`, []))

/**
 * The user pressed send while files were still uploading. We hold the send
 * (don't drop the in-flight files) and dispatch it automatically once every
 * upload settles. Per channel so holding in one DM doesn't block another.
 */
export const pendingSendAtom = atomFamily((_channelID: string) => atom<boolean>(false))


/**
 * Server upload limits, read from frappe.boot:
 * - `max_file_size`: max bytes per file (0 / absent → no limit).
 * - `sysdefaults.allowed_file_extensions`: newline/comma list of permitted
 *   extensions; empty → every type is allowed.
 *
 * TODO: large files can be uploaded in chunks (`frappe.boot.file_chunk_size`). We
 * don't chunk yet, so anything over `max_file_size` is rejected outright for now.
 */
const getMaxFileSize = (): number => {
    const size = Number(window.frappe?.boot?.max_file_size)
    return Number.isFinite(size) && size > 0 ? size : 0
}

const getAllowedExtensions = (): string[] => {
    const raw = window.frappe?.boot?.sysdefaults?.allowed_file_extensions
    if (!raw) return []
    const list = Array.isArray(raw) ? raw : String(raw).split(/[\n,]+/)
    // Normalise to bare, lowercased extensions to match getFileExtension's output.
    return list.map((e: string) => e.trim().toLowerCase().replace(/^\./, '')).filter(Boolean)
}

/** Drop files that exceed the size limit or aren't an allowed type, toasting each rejection. */
const filterAllowedFiles = (files: File[]): File[] => {
    const maxSize = getMaxFileSize()
    const allowed = getAllowedExtensions()

    return files.filter((file) => {
        if (maxSize && file.size > maxSize) {
            toast.error(_('{0} is too large. The maximum file size allowed is {1}.', [file.name, formatBytes(maxSize)]))
            return false
        }
        if (allowed.length && !allowed.includes(getFileExtension(file.name))) {
            toast.error(_('{0} can\'t be uploaded. Allowed file types: {1}.', [file.name, allowed.join(', ')]))
            return false
        }
        return true
    })
}

export const useAttachFile = (channelID: string) => {

    const { file } = useContext(FrappeContext) as FrappeConfig


    const setUploadingFiles = useSetAtom(uploadingFilesAtom(channelID))
    const setUploadedFiles = useSetAtom(uploadedFilesAtom(channelID))

    /** 
     * When a file is attached by the user, start uploading it immediately
     * The user should not wait for files to upload when they hit the send button.
     */
    const onAddFile = (files: FileList | File[]) => {
        // Enforce the server's size + type limits up front (covers the attach button,
        // paste, and drop — all routed through here). Rejected files are toasted.
        const allowedFiles = filterAllowedFiles(Array.from(files))
        if (allowedFiles.length === 0) return

        const filesToBeUploaded = allowedFiles.map((file) => ({
            file: file,
            uploadProgress: 0,
            status: 'uploading' as const,
            // NOT crypto.randomUUID — that's secure-context-only, and it crashing
            // here silently ate "attach photo" on LAN-IP (http) dev builds.
            id: randomUUID(),
            fileName: file.name,
            size: file.size,
            timestamp: Date.now()
        }))
        setUploadingFiles((prevFiles) => [...prevFiles, ...filesToBeUploaded])

        // The upload can't be aborted (the SDK has no abort signal), so we instead
        // check at settle-time whether the file is still tracked: if the user removed
        // it mid-upload it's gone from uploadingFilesAtom, and we drop the result
        // rather than resurrecting it (as an uploaded file or an error).
        const store = getDefaultStore()
        const isStillTracked = (id: string) => store.get(uploadingFilesAtom(channelID)).some((item) => item.id === id)

        for (const f of filesToBeUploaded) {
            // Measured in parallel with the upload — resolved long before it.
            const dimensions = measureMediaDimensions(f.file)
            file.uploadFile(f.file, {
                doctype: 'Raven Message',
                isPrivate: true
            }, (_uploadedBytes, _totalBytes, progress) => {
                const progressPercentage = Math.round((progress?.progress ?? 0) * 100)
                setUploadingFiles((prevFiles) => {
                    const current = prevFiles.find((item) => item.id === f.id)
                    // Skip redundant writes (the rounded % often repeats) — returning the
                    // same reference means no notify, so subscribers don't re-render.
                    if (!current || current.uploadProgress === progressPercentage) return prevFiles
                    return prevFiles.map((item) => item.id === f.id ? { ...item, uploadProgress: progressPercentage, status: 'uploading' as const } : item)
                })
            }).then(async res => {
                if (!isStillTracked(f.id)) return
                const dims = await dimensions
                // When upload is finished, add the file to the uploaded files atom and remove from the uploading files atom
                setUploadedFiles((prevFiles) => [...prevFiles, {
                    fileID: res.data.message.name,
                    fileURL: res.data.message.file_url,
                    id: f.id,
                    fileName: f.fileName,
                    // Prefer the server's File.file_size (authoritative); fall back to the browser size.
                    size: res.data.message.file_size ?? f.size,
                    timestamp: f.timestamp,
                    width: dims?.width,
                    height: dims?.height,
                }])
                setUploadingFiles((prevFiles) => prevFiles.filter((item) => item.id !== f.id))

                // A held send (pendingSendAtom) is dispatched by ChatInput once
                // uploadingFilesAtom drains — no per-file bookkeeping needed here.
            }).catch(() => {
                if (!isStillTracked(f.id)) return
                toast.error("There was an error while uploading the file " + f.file.name)
                setUploadingFiles((prevFiles) => prevFiles.map((item) => item.id === f.id ? { ...item, status: 'error' as const } : item))
            })
        }
    }

    return onAddFile
}

export interface FileItemType {
    id: string,
    fileName: string,
    size: number,
    timestamp: number,
    uploadProgress?: number,
    status: 'uploading' | 'uploaded' | 'error',
    fileID?: string,
    fileURL?: string,
}

export const useRemoveFile = (channelID: string) => {

    const { deleteDoc } = useFrappeDeleteDoc()
    const setUploadedFiles = useSetAtom(uploadedFilesAtom(channelID))
    const setUploadingFiles = useSetAtom(uploadingFilesAtom(channelID))

    /** 
     * TODO: Add support for AbortController to cancel requests mid-flight
     * When the user decides to delete a file they attached, check if the file is being uploaded.
     * If it is already uploaded, delete the file from the server.
     * If it is being uploaded, wait for the file to upload and then delete the file from the server.
     * 
     */
    const onRemoveFile = (file: FileItemType) => {
        if (file.fileID) {
            setUploadedFiles((prevFiles) => prevFiles.filter((f) => f.fileID !== file.fileID))
            deleteDoc('File', file.fileID)
        } else {
            // Remove from both queues using frontend ID
            setUploadingFiles((prevFiles) => prevFiles.filter((f) => f.id !== file.id))
            setUploadedFiles((prevFiles) => prevFiles.filter((f) => f.id !== file.id))
        }

    }

    return onRemoveFile
}