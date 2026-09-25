import { isPrivateFile, siteUrl } from "@lib/site"
import { mediaSrc } from "../native/mediaUrl"

/** Site file path → something an <img>, <video>, or <audio> can load. */
export const fileSrc = (url: string): string => {
    // In the browser the site is the page's own origin, and an <img> carries the session itself.
    if (!import.meta.env.VITE_NATIVE) return url
    // A public file loads straight from the site; only private ones need the bearer the proxy adds.
    return isPrivateFile(url) ? mediaSrc(url) : siteUrl(url)
}

export const useFileSrc = (url?: string): string | undefined => (url ? fileSrc(url) : undefined)
