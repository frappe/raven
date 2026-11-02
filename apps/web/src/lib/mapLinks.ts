import { inCoordinateRange, type LocationMeta } from "./location"

export type MapProvider = "google" | "apple"

type MapLinkDetails = {
    name: string | null
    address: string | null
    coordinates: LocationMeta | null
}

// Exact hosts only: country forms like google.co.in and google.com.au both match.
const GOOGLE_HOST = /^(www\.)?google\.(com|[a-z]{2}|com?\.[a-z]{2})$/
const GOOGLE_MAPS_HOST = /^maps\.google\.(com|[a-z]{2}|com?\.[a-z]{2})$/
const GOOGLE_AT_COORDINATES = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
const COORDINATE_TEXT = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/
const GOOGLE_IMAGE_HOSTS = new Set(["maps.google.com", "maps.googleapis.com"])
const APPLE_IMAGE_HOST = "snapshot.apple-mapkit.com"
const GOOGLE_PLACE_PATH = /\/maps\/place\/([^/]+)/
const MAX_TEXT_LENGTH = 200

const parse = (href: string): URL | null => {
    try {
        const url = new URL(href)
        return url.protocol === "http:" || url.protocol === "https:" ? url : null
    } catch {
        return null
    }
}

/** Trimmed, single-spaced, capped plain text; never HTML. */
const cleanText = (value: string | null | undefined): string | null => {
    const text = value?.replace(/\s+/g, " ").trim()
    return text ? text.slice(0, MAX_TEXT_LENGTH) : null
}

const cleanPathSegment = (value: string): string => {
    const spaced = value.replace(/\+/g, " ")
    try {
        return decodeURIComponent(spaced)
    } catch {
        return spaced
    }
}

const coordinatePair = (value: string | null): LocationMeta | null => {
    if (!value) return null
    const parts = value.split(",")
    if (parts.length !== 2) return null
    const latitude = Number(parts[0].trim())
    const longitude = Number(parts[1].trim())
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return inCoordinateRange(latitude, longitude) ? { latitude, longitude } : null
}

const googleDetails = (url: URL): MapLinkDetails => {
    const place = GOOGLE_PLACE_PATH.exec(url.pathname)
    const query = url.searchParams.get("q") ?? url.searchParams.get("query")
    const queryCoordinates = coordinatePair(query)
    const at = GOOGLE_AT_COORDINATES.exec(url.pathname)
    const coordinates = at
        ? coordinatePair(`${at[1]},${at[2]}`)
        : (queryCoordinates ?? coordinatePair(url.searchParams.get("ll")))
    const queryName = queryCoordinates || (query && COORDINATE_TEXT.test(query)) ? null : cleanText(query)

    return {
        name: cleanText(place ? cleanPathSegment(place[1]) : null) ?? queryName,
        address: null,
        coordinates,
    }
}

const appleDetails = (url: URL, previewTitle?: string | null): MapLinkDetails => ({
    name:
        cleanText(url.searchParams.get("name")) ??
        cleanText(url.searchParams.get("q")) ??
        cleanText(previewTitle),
    address: cleanText(url.searchParams.get("address")),
    coordinates: coordinatePair(url.searchParams.get("coordinate") ?? url.searchParams.get("ll")),
})

// Mirror of detect_provider's maps rule in raven/links.py — keep in sync.
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

/** The provider's map snapshot URL from a fetched preview, or null when it is not usable. */
export const mapPreviewImage = (
    provider: MapProvider,
    preview: { image?: string } | null | undefined,
): string | null => {
    const image = preview?.image
    if (!image) return null
    const url = parse(image)
    if (!url) return null
    if (provider === "google") {
        if (!GOOGLE_IMAGE_HOSTS.has(url.hostname)) return null
        if (!url.pathname.includes("/maps/api/staticmap")) return null
        return Number(url.searchParams.get("zoom")) >= 15 ? image : null
    }
    return url.hostname === APPLE_IMAGE_HOST ? image : null
}

/** Place name, address and coordinates parsed from a map link; all null when the URL has none. */
export const mapLinkDetails = (
    href: string,
    provider: MapProvider,
    previewTitle?: string | null,
): MapLinkDetails => {
    const url = parse(href)
    if (!url) return { name: null, address: null, coordinates: null }
    return provider === "google" ? googleDetails(url) : appleDetails(url, previewTitle)
}
