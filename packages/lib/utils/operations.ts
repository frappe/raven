/**
 * Function to remove the current user from the DM Channel Name - used when the peer user is not found
 * @param channelName 
 * @param currentUser 
 * @returns 
 */
export const replaceCurrentUserFromDMChannelName = (channelName: string, currentUser: string) => {
    return channelName.replace(currentUser, '').replace(' _ ', '')
}

/**
 * Function to return extension of a file
 * @param filename name of the file with extension
 * @returns extension
 */
export const getFileExtension = (filename: string) => {
    const name = getFileName(filename)
    return name.includes('.') ? name.split('.').pop()?.toLocaleLowerCase() ?? '' : ''
}

export const VIDEO_FORMATS = ['mp4', 'webm']
/**
 * Function to check if a file is a video
 * @param extension extension of the file
 * @returns boolean
 */
export const isVideoFile = (ext: string) => {

    return VIDEO_FORMATS.includes(ext)
}

export const IMAGE_FORMATS = ['jpg', 'jpeg', 'png']
/**
 * Function to check if a file is an image
 * @param extension extension of the file
 * @returns boolean
 */
export const isImageFile = (ext: string) => {

    return IMAGE_FORMATS.includes(ext)
}

/**
 * The name of a file from its URL or path, with its extension. A download link names the
 * file in its query, e.g. `/api/method/download_file?file_url=/private/files/a.jpg&file_name=a.jpg`.
 * @param fileURL a file URL, a path, or a bare file name
 * @returns the file name, or an empty string
 */
export function getFileName(fileURL: string) {
    const [path, query = ''] = (fileURL ?? '').split('?')
    const params = new URLSearchParams(query)
    const named = params.get('file_name') || params.get('file_url')?.split('?')[0].split('/').pop()
    return named || path.split('/').pop() || ''
}

export const getFileMimeType = (fileName: string) => {
    const extension = getFileExtension(fileName)
    const mimeTypes: { [key: string]: string } = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        mp4: 'video/mp4',
    };
    return mimeTypes[extension as keyof typeof mimeTypes] || '*/*';
}

// list of mostly used file extensions
export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'ico', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm']

/**
 * Function to format bytes to human readable format
 * @param bytes size in bytes
 * @param decimals number of decimal places
 * @returns string of human readable size
 */
export const formatBytes = (bytes: number, decimals = 0) => {

    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

export const getSiteNameFromUrl = (url?: string) => {
    if (!url) return ''
    return url.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
}