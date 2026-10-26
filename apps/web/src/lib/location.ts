import { isIOS } from "@utils/platform"

/** A shared location's payload, stored in the message's `json`. */
export type LocationMeta = {
    latitude: number
    longitude: number
}

export const MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
// Constant, never user input, so Leaflet's HTML rendering is safe.
export const MAP_ATTRIBUTION_HTML =
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'

export type MapTile = { url: string; left: number; top: number; size: number }

const MAX_LATITUDE = 85.05112878

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value)

// Mirror of _sane_coordinate in raven/api/location.py — keep in sync.
/** A finite latitude/longitude pair inside the WGS84 bounds. */
const inCoordinateRange = (latitude: number, longitude: number): boolean =>
    isFiniteNumber(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    isFiniteNumber(longitude) &&
    longitude >= -180 &&
    longitude <= 180

/** A location's `json` (object, or string from a fetch); null unless it has usable coordinates. */
export const parseLocationJson = (json: unknown): LocationMeta | null => {
    let value = json
    if (typeof value === "string") {
        try {
            value = JSON.parse(value)
        } catch {
            return null
        }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null

    const { latitude, longitude } = value as Record<string, unknown>
    if (typeof latitude !== "number" || typeof longitude !== "number") return null
    if (!inCoordinateRange(latitude, longitude)) return null
    return { latitude, longitude }
}

const mercatorPixel = (latitude: number, longitude: number, zoom: number, tileSize: number) => {
    const worldSize = tileSize * 2 ** zoom
    const clampedLatitude = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude))
    const radians = (clampedLatitude * Math.PI) / 180
    const x = ((longitude + 180) / 360) * worldSize
    const y = ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * worldSize
    return { x, y }
}

const tileUrl = (zoom: number, x: number, y: number): string =>
    MAP_TILE_URL.replace("{z}", String(zoom))
        .replace("{x}", String(x))
        .replace("{y}", String(y))

/** OSM tiles covering a `width × height` box with the point at its centre. */
export const tilesFor = (
    latitude: number,
    longitude: number,
    zoom: number,
    width: number,
    height: number,
    tileSize = 256,
): MapTile[] => {
    const { x: pixelX, y: pixelY } = mercatorPixel(latitude, longitude, zoom, tileSize)
    const count = 2 ** zoom
    const firstX = Math.floor((pixelX - width / 2) / tileSize)
    const lastX = Math.ceil((pixelX + width / 2) / tileSize) - 1
    const firstY = Math.floor((pixelY - height / 2) / tileSize)
    const lastY = Math.ceil((pixelY + height / 2) / tileSize) - 1

    const tiles: MapTile[] = []
    for (let tileX = firstX; tileX <= lastX; tileX++) {
        const wrappedX = ((tileX % count) + count) % count
        for (let tileY = firstY; tileY <= lastY; tileY++) {
            if (tileY < 0 || tileY >= count) continue
            tiles.push({
                url: tileUrl(zoom, wrappedX, tileY),
                left: tileX * tileSize - pixelX + width / 2,
                top: tileY * tileSize - pixelY + height / 2,
                size: tileSize,
            })
        }
    }
    return tiles
}

const coordinates = (meta: Pick<LocationMeta, "latitude" | "longitude">): string =>
    `${meta.latitude},${meta.longitude}`

/** `"12.97561, 77.60659"` (5 decimal places). */
export const formatCoordinates = (meta: Pick<LocationMeta, "latitude" | "longitude">): string =>
    `${meta.latitude.toFixed(5)}, ${meta.longitude.toFixed(5)}`

// Mirror of maps_url in raven/api/location.py — keep in sync.
export const googleMapsUrl = (meta: LocationMeta): string =>
    `https://www.google.com/maps/search/?api=1&query=${coordinates(meta)}`

export const appleMapsUrl = (meta: LocationMeta): string =>
    `https://maps.apple.com/?ll=${coordinates(meta)}&q=Location`

export const appleMapsAppUrl = (meta: LocationMeta): string =>
    `maps://?ll=${coordinates(meta)}&q=Location`

export const googleMapsAppUrl = (meta: LocationMeta): string =>
    `comgooglemaps://?q=${coordinates(meta)}&center=${coordinates(meta)}`

export const wazeAppUrl = (meta: LocationMeta): string =>
    `waze://?ll=${coordinates(meta)}&navigate=no`

export const wazeWebUrl = (meta: LocationMeta): string =>
    `https://www.waze.com/ul?ll=${coordinates(meta)}`

export const geoUri = (meta: LocationMeta): string =>
    `geo:${coordinates(meta)}?q=${coordinates(meta)}(Location)`

export const senderMapsProvider = (): "apple" | "google" => (isIOS ? "apple" : "google")

export const senderMapsUrl = (meta: LocationMeta): string =>
    senderMapsProvider() === "apple" ? appleMapsUrl(meta) : googleMapsUrl(meta)
