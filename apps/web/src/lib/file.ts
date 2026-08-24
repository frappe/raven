/**
 * Function to return extension of a file
 * @param filename name of the file with extension
 * @returns extension
 */
export const getFileExtension = (filename: string) => {

    const fileNameWithoutQuery = filename?.split('?')[0]

    const extension = fileNameWithoutQuery?.split('.').pop()?.toLocaleLowerCase() ?? ''
    return extension;
}

/**
 * Function to format bytes to human readable format
 * @param bytes size in bytes
 * @param decimals number of decimal places
 * @returns string of human readable size
 */
export const formatBytes = (bytes: number, decimals = 2) => {

    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}


export const imageExt = ["jpeg", "jpg", "png"]

export const excelExt = ['csv', 'xls', 'xlsx']

export const pptExt = ['ppt', 'pptx']

export const wordExt = ['doc', 'docx']

export const videoExt = ['mp4', 'mkv', 'webm', 'avi', 'mov']

export const audioExt = ['mp3', 'wav', 'ogg', 'flac']

export const getFileType = (ext: string) => {
    switch (ext) {
        case 'pdf': return 'pdf'
        case 'doc': return 'word'
        case 'docx': return 'word'
        case 'xls': return 'excel'
        case 'xlsx': return 'excel'
        case 'ppt': return 'powerpoint'
        case 'pptx': return 'powerpoint'
        case 'mp3': return 'audio'
        case 'wav': return 'audio'
        case 'ogg': return 'audio'
        case 'flac': return 'audio'
        case 'mp4': return 'video'
        case 'mkv': return 'video'
        case 'webm': return 'video'
        case 'avi': return 'video'
        case 'mov': return 'video'
        case 'jpeg': return 'image'
        case 'jpg': return 'image'
        case 'png': return 'image'
        default: return 'file'
    }
}

/**
 * Absolute, shareable URL for a Raven file, minus the `?fid=…` access token — a
 * link carrying it is scoped to one recipient, so pasting it elsewhere hands over
 * a URL that stops working. The backend strips it the same way when forwarding
 * (raven_message.py:861).
 *
 * `origin` is a parameter (not read straight off `window`) so the pure logic is
 * testable in vitest's node environment.
 */
export const getAbsoluteFileURL = (fileURL: string, origin: string = window.location.origin): string =>
	new URL(fileURL.split('?')[0], origin).href

/** Triggers a browser download of a (session-authenticated) file URL. */
export const downloadFile = (url: string, fileName?: string) => {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName || ''
    anchor.rel = 'noopener'
    anchor.click()
}

/**
 * Saves an already-fetched blob. The counterpart to `downloadFile` for responses that
 * must be FETCHED rather than navigated to — navigating an anchor at an API endpoint
 * would dump a backend error onto the screen as raw JSON, whereas fetching keeps the
 * failure in JS where it can become a toast.
 */
export const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    try {
        downloadFile(url, fileName)
    } finally {
        // Not revoked synchronously: some browsers cancel the in-flight save if the object
        // URL disappears before the click has been serviced.
        setTimeout(() => URL.revokeObjectURL(url), 0)
    }
}

/** Fetches a (session-authenticated) file URL into a File for the Web Share API. */
const fetchAsFile = async (url: string, fileName: string): Promise<File | null> => {
    try {
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) return null
        const blob = await response.blob()
        return new File([blob], fileName || 'file', { type: blob.type })
    } catch {
        return null
    }
}

/**
 * `navigator.share`, reporting whether the share ACTUALLY happened.
 *
 * The distinction matters: a dismissed share sheet rejects with AbortError and is a
 * success from our side (the user saw the sheet and chose not to send). Every other
 * rejection means the sheet never opened, and the caller still owes the user something.
 * The one that bites in a phone PWA is NotAllowedError — Safari requires transient user
 * activation, and awaiting a fetch of the file itself can outlive the tap that started
 * it, so the share is refused. Swallowing that and reporting success is what makes a
 * Download button look like it does nothing at all.
 */
const attemptShare = async (data: ShareData): Promise<boolean> => {
    try {
        await navigator.share(data)
        return true
    } catch (error) {
        return (error as DOMException)?.name === 'AbortError'
    }
}

/**
 * Shares the FILE itself where the platform allows it (recipient gets the
 * file, not a link needing a Raven session), falling back to a URL share,
 * then to copying the link. Returns 'copied' when the clipboard fallback ran
 * so callers can toast, or 'failed' when even that didn't work (e.g.
 * `navigator.clipboard` is undefined in an insecure context — LAN-IP http dev
 * builds hit this) — callers must handle it explicitly, not let it reject.
 */
export const shareFile = async (fileUrl: string, fileName: string): Promise<'shared' | 'copied' | 'failed'> => {
    const url = getAbsoluteFileURL(fileUrl)

    const file = await fetchAsFile(url, fileName)
    if (file && navigator.canShare?.({ files: [file] })) {
        if (await attemptShare({ files: [file] })) return 'shared'
        // Fall through: the share never happened, so a later fallback still has to run.
    }

    if (typeof navigator.share === 'function' && (await attemptShare({ title: fileName, url }))) {
        return 'shared'
    }

    try {
        await navigator.clipboard.writeText(url)
        return 'copied'
    } catch {
        return 'failed'
    }
}
