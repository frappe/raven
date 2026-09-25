import { isPrivateFile, siteToken, siteUrl } from "@lib/site"
import { mediaFolder } from "./mediaUrl"
import { nativePlugin } from "./platform"

// Share-out needs the whole file on disk. RavenDownload streams it natively with the bearer (no
// CORS: hosted sites serve public files straight from nginx), reports progress, and can be cancelled.
const DIR = "media"

type Progress = { id: string; bytes: number; total: number }
type RavenDownloadPlugin = {
    download(options: { id: string; url: string; name: string; headers: Record<string, string> }): Promise<{ path: string }>
    cancel(options: { id: string }): Promise<void>
    addListener(event: "progress", listener: (e: Progress) => void): Promise<{ remove(): Promise<void> }>
}

const downloader = nativePlugin<RavenDownloadPlugin>("RavenDownload")

/** Cache path of a site file, shared with the media proxy so one download serves both. */
export const downloadName = (path: string) => {
    const { folder, file } = mediaFolder(path)
    return `${DIR}/${folder}/${file}`
}

const inflight = new Map<string, Promise<string>>()

/** Downloads a site file into the cache directory; resolves to its file URI, rejects "cancelled" on cancel. */
export const downloadToCache = (path: string, id: string, onProgress?: (fraction: number) => void): Promise<string> => {
    // A second tap while the same file is on its way joins that transfer; registered before any await.
    const running = inflight.get(path)
    if (running) return running
    const promise = fetchToCache(path, id, onProgress).finally(() => inflight.delete(path))
    inflight.set(path, promise)
    return promise
}

const fetchToCache = async (path: string, id: string, onProgress?: (fraction: number) => void): Promise<string> => {
    const { Filesystem, Directory } = await import("@capacitor/filesystem")
    const file = { path: downloadName(path), directory: Directory.Cache }
    // Already on disk from an earlier share: the native side only writes the final name when complete.
    const cached = await Filesystem.stat(file).catch(() => null)
    if (cached) return cached.uri
    const { plugin } = await downloader()
    // Only private files need the token, and only the site may see it.
    const token = isPrivateFile(path) ? siteToken() : undefined
    const progress = onProgress && await plugin.addListener("progress", (e) => {
        if (e.id === id && e.total > 0) onProgress(e.bytes / e.total)
    })
    try {
        const { path: saved } = await plugin.download({ id, url: siteUrl(path), name: file.path.slice(DIR.length + 1), headers: token ? { Authorization: `Bearer ${token}` } : {} })
        return `file://${saved}`
    } finally {
        progress?.remove().catch(() => { })
    }
}

export const cancelDownload = async (id: string) => {
    const { plugin } = await downloader()
    await plugin.cancel({ id }).catch(() => { })
}

/** Logout: nothing of the site's files stays on disk. */
export const clearMediaCache = async () => {
    const { Filesystem, Directory } = await import("@capacitor/filesystem")
    await Filesystem.rmdir({ path: DIR, directory: Directory.Cache, recursive: true }).catch(() => { })
}
