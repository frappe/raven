import { siteUrl } from "@lib/site"

// Pure: imported by the page's render path, so nothing here may touch Capacitor.

/** Stable cache location per site file: a hash folder, so the file keeps its own name for the share sheet. */
export const mediaFolder = (path: string) => {
    const url = siteUrl(path)
    let hash = 5381
    for (let i = 0; i < url.length; i++) hash = ((hash * 33) ^ url.charCodeAt(i)) >>> 0
    const base = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "").replace(/[^\w.-]/g, "_").replace(/^\.+/, "")
    return { folder: hash.toString(36), file: base || "file" }
}

// Private files on hosted sites fail CORS and an <img> cannot send the bearer: RavenMedia serves these
// natively with the bearer, Range included, and tees full responses into media/<folder>/<file>.
// iOS registers a scheme; Android's WebView drops unknown schemes, so it intercepts a path on the app's origin.
export const MEDIA_PATH = "/_raven_media_/"
const mediaBase = () => (typeof location !== "undefined" && location.protocol === "https:" ? `${location.origin}${MEDIA_PATH}` : "raven-media://")

export const mediaSrc = (path: string): string => {
    const url = siteUrl(path)
    const { folder, file } = mediaFolder(url)
    return `${mediaBase()}${folder}/${file}?src=${encodeURIComponent(url)}`
}
