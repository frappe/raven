/**
 * Chunked uploads against Frappe's `upload_file`, which appends each chunk to a temp
 * file and returns the File doc on the last one. `max_file_size` still caps the whole
 * file; chunks only keep each request under proxy body limits.
 */

export const DEFAULT_CHUNK_SIZE = 25 * 1024 * 1024

/** Chunk size the server expects (site_config `file_chunk_size`), else Frappe's 25 MB default. */
export const getFileChunkSize = (): number => {
    const size = Number(window.frappe?.boot?.file_chunk_size)
    return Number.isFinite(size) && size > 0 ? size : DEFAULT_CHUNK_SIZE
}

export type ChunkPlanItem = { index: number; start: number; end: number }

/** Byte ranges to send. Always at least one, so an empty file still uploads. */
export const getChunkPlan = (fileSize: number, chunkSize: number): ChunkPlanItem[] => {
    const count = Math.max(1, Math.ceil(fileSize / chunkSize))
    return Array.from({ length: count }, (_, index) => ({
        index,
        start: index * chunkSize,
        end: Math.min(fileSize, (index + 1) * chunkSize),
    }))
}

/** Form fields Frappe's `upload_file` reads alongside the file. */
export type UploadFields = Record<string, number>

export type SendChunk<T> = (blob: File, fields: UploadFields, onLoaded: (loadedBytes: number) => void) => Promise<T>

export type ChunkedUploadOutcome<T> = { cancelled: true } | { cancelled: false; result: T }

export type UploadOptions = {
    onProgress?: (fraction: number) => void
    shouldContinue?: () => boolean
    /** Wait before each restart; its length is the number of restarts. */
    retryDelaysMs?: number[]
}

const RETRY_DELAYS_MS = [1000, 3000]

/** No response (offline, timeout), or a proxy / rate limit turned the request away. */
const TRANSIENT_STATUSES = new Set([0, 408, 429, 502, 503, 504])

export const isTransientUploadError = (error: unknown): boolean => {
    const status = (error as { httpStatus?: unknown } | null | undefined)?.httpStatus
    return typeof status === "number" && TRANSIENT_STATUSES.has(status)
}

/**
 * Upload `file` through `sendChunk`, one chunk at a time, restarting from the first
 * chunk after a transient failure. Resolves with the last chunk's response, or
 * `{ cancelled: true }` once `shouldContinue` says stop.
 */
export const uploadInChunks = <T>(
    file: File,
    chunkSize: number,
    sendChunk: SendChunk<T>,
    options: UploadOptions = {},
): Promise<ChunkedUploadOutcome<T>> => {
    const plan = getChunkPlan(file.size, chunkSize)
    // Frappe keys its upload temp file on user + file name, chunked or not, so
    // same-name uploads in parallel overwrite each other.
    return withUploadLock(file.name, () => sendWithRestarts(file, plan, sendChunk, options))
}

const sendWithRestarts = async <T>(
    file: File,
    plan: ChunkPlanItem[],
    sendChunk: SendChunk<T>,
    options: UploadOptions,
): Promise<ChunkedUploadOutcome<T>> => {
    const { retryDelaysMs = RETRY_DELAYS_MS, onProgress } = options
    for (let attempt = 0; ; attempt++) {
        try {
            return await sendPlan(file, plan, sendChunk, options)
        } catch (error) {
            if (attempt >= retryDelaysMs.length || !isTransientUploadError(error)) throw error
        }
        // Restart from chunk 0, which truncates the temp file. Frappe appends chunks,
        // so resending one whose response was lost would store its bytes twice.
        onProgress?.(0)
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]))
    }
}

const sendPlan = async <T>(
    file: File,
    plan: ChunkPlanItem[],
    sendChunk: SendChunk<T>,
    { onProgress, shouldContinue }: UploadOptions,
): Promise<ChunkedUploadOutcome<T>> => {
    const send = ({ index, start, end }: ChunkPlanItem) => {
        const onLoaded = (loaded: number) => onProgress?.(file.size ? Math.min(1, (start + loaded) / file.size) : 1)
        if (plan.length === 1) return sendChunk(file, { total_file_size: file.size }, onLoaded)
        // Re-wrap the slice so the server sees the original file name on every chunk.
        const blob = new File([file.slice(start, end)], file.name, { type: file.type })
        const fields = { chunk_index: index, total_chunk_count: plan.length, chunk_byte_offset: start, total_file_size: file.size }
        return sendChunk(blob, fields, onLoaded)
    }
    const stopped = () => shouldContinue !== undefined && !shouldContinue()

    for (const item of plan.slice(0, -1)) {
        if (stopped()) return { cancelled: true }
        await send(item)
    }
    if (stopped()) return { cancelled: true }
    return { cancelled: false, result: await send(plan[plan.length - 1]) }
}

/** Tail of the uploads queued per file name; never rejects. */
const uploadTails = new Map<string, Promise<unknown>>()

const withUploadLock = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const run = (uploadTails.get(key) ?? Promise.resolve()).then(task)
    const tail = run.catch(() => undefined)
    uploadTails.set(key, tail)
    tail.then(() => {
        if (uploadTails.get(key) === tail) uploadTails.delete(key)
    })
    return run
}
