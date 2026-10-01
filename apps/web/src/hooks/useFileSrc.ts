import { isPrivateFile, siteOrigin, siteUrl } from "@lib/site"
import { mediaSrc, mediaTarget } from "../native/mediaUrl"

/** The site path a saved address stands for; a media address loads only on the device that made it. */
export const sitePath = (src: string): string => {
    const url = mediaTarget(src) ?? src
    if (!url.startsWith("http")) return url
    const origin = siteOrigin()
    return url.startsWith(`${origin}/`) ? url.slice(origin.length) : url
}

/** Site file path, or a saved address of one, → something an <img>, <video>, or <audio> can load. */
export const fileSrc = (url: string): string => {
    const path = sitePath(url)
    // In the browser the site is the page's own origin, and an <img> carries the session itself.
    if (!import.meta.env.VITE_NATIVE) return path
    // A public file loads straight from the site; only private ones need the bearer the proxy adds.
    return isPrivateFile(path) ? mediaSrc(path) : siteUrl(path)
}

export const useFileSrc = (url?: string): string | undefined => (url ? fileSrc(url) : undefined)
