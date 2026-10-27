import type { Message } from "@raven/types/common/Message"
import { isBlockedPreviewDomain } from "./blockedPreviewDomains"
import { firstLink } from "./firstLink"

export type MapProvider = "google" | "apple"

type PreviewImage = {
    image?: string
    image_width?: number
    image_height?: number
} | null | undefined

// Exact hosts only: country forms like google.co.in and google.com.au both match.
const GOOGLE_HOST = /^(www\.)?google\.(com|[a-z]{2}|com?\.[a-z]{2})$/
const GOOGLE_MAPS_HOST = /^maps\.google\.(com|[a-z]{2}|com?\.[a-z]{2})$/
const GOOGLE_IMAGE_HOSTS = new Set(["maps.google.com", "maps.googleapis.com"])
const APPLE_IMAGE_HOST = "snapshot.apple-mapkit.com"
const DEFAULT_ASPECT = 3 / 2

const parse = (href: string): URL | null => {
    try {
        const url = new URL(href)
        return url.protocol === "http:" || url.protocol === "https:" ? url : null
    } catch {
        return null
    }
}

/** The maps provider a link points at, or null for anything else. */
export const matchMapLink = (href: string): MapProvider | null => {
    const url = parse(href)
    if (!url) return null
    const host = url.hostname
    if (GOOGLE_MAPS_HOST.test(host) || host === "maps.app.goo.gl") return "google"
    if (host === "goo.gl" && url.pathname.startsWith("/maps")) return "google"
    if (GOOGLE_HOST.test(host) && url.pathname.startsWith("/maps")) return "google"
    if (host === "maps.apple.com" || host === "maps.apple") return "apple"
    return null
}

/** The provider image to show for a link preview, with its aspect ratio; null when unusable. */
export const mapPreviewImage = (
    provider: MapProvider,
    preview: PreviewImage,
): { url: string; aspect: number } | null => {
    const image = preview?.image
    if (!image) return null
    const url = parse(image)
    if (!url) return null

    if (provider === "google") {
        if (!GOOGLE_IMAGE_HOSTS.has(url.hostname)) return null
        if (!url.pathname.includes("/maps/api/staticmap")) return null
        if (!(Number(url.searchParams.get("zoom")) >= 15)) return null
    } else if (url.hostname !== APPLE_IMAGE_HOST) {
        return null
    }

    const width = preview?.image_width ?? 0
    const height = preview?.image_height ?? 0
    const raw = width > 0 && height > 0 ? width / height : DEFAULT_ASPECT
    return { url: image, aspect: Math.min(2.5, Math.max(0.5, raw)) }
}

/** True when the message is nothing but one map link and its preview is allowed. */
export const isMapLinkOnly = (message: Message): boolean => {
    // Runs for every text message: cheapest checks first, so a message without links costs one read.
    if (!message.links || message.hide_link_preview || message.message_type !== "Text") return false
    const link = firstLink(message.links)
    if (!link || (message.content ?? "").trim() !== link || !matchMapLink(link)) return false
    return !isBlockedPreviewDomain(link) && !message.text.includes("<img")
}
