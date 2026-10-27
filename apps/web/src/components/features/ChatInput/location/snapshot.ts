import { tilesFor, type LocationMeta, type MapTile } from "@lib/location"

export const SNAPSHOT_WIDTH = 240
export const SNAPSHOT_HEIGHT = 160
export const SNAPSHOT_TIMEOUT_MS = 5000
export const SNAPSHOT_MIN_ZOOM = 15
export const SNAPSHOT_MAX_ZOOM = 18

export type Snapshot = { file_url: string; file_size: number }
export type SnapshotDrawPlan = { tiles: MapTile[] }

// Leaflet's zoom can be fractional mid-animation; tile URLs need an integer.
const clampZoom = (zoom: number): number =>
    Math.min(SNAPSHOT_MAX_ZOOM, Math.max(SNAPSHOT_MIN_ZOOM, Math.round(zoom)))

/** Tiles for the 240 × 160 (3:2) snapshot, centred on the point. */
export const snapshotDrawPlan = (meta: LocationMeta, zoom: number): SnapshotDrawPlan => ({
    tiles: tilesFor(meta.latitude, meta.longitude, clampZoom(zoom), SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT, 256),
})

/** `promise`'s value, or null once `ms` passes; rejections become null too. */
export const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
    new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms)
        promise.then(
            (value) => {
                clearTimeout(timer)
                resolve(value)
            },
            () => {
                clearTimeout(timer)
                resolve(null)
            },
        )
    })

const loadTile = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        // Matches the Leaflet tile layer's crossOrigin so cached tiles are reusable.
        image.crossOrigin = "anonymous"
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("Tile failed"))
        image.src = url
    })

/** Tiles only; the card overlays the pin and OSM credit. */
export const drawSnapshot = (
    context: CanvasRenderingContext2D,
    plan: SnapshotDrawPlan,
    images: HTMLImageElement[],
) => {
    plan.tiles.forEach((tile, index) => {
        context.drawImage(images[index], tile.left, tile.top, tile.size, tile.size)
    })
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.8))

/** The upload's name: never the coordinates, which would leak through file paths. */
export const snapshotFileName = (type: string): string =>
    type === "image/png" ? "location.png" : "location.webp"

const fileFor = (blob: Blob): File => new File([blob], snapshotFileName(blob.type), { type: blob.type })

/** A small map image of the point, or null when any tile, canvas or encode step fails. */
export const renderLocationSnapshot = async (meta: LocationMeta, zoom: number): Promise<File | null> => {
    try {
        const plan = snapshotDrawPlan(meta, zoom)
        const images = await Promise.all(plan.tiles.map((tile) => loadTile(tile.url)))
        const canvas = document.createElement("canvas")
        canvas.width = SNAPSHOT_WIDTH
        canvas.height = SNAPSHOT_HEIGHT
        const context = canvas.getContext("2d")
        if (!context) return null
        drawSnapshot(context, plan, images)
        const blob = await toBlob(canvas)
        return blob ? fileFor(blob) : null
    } catch {
        return null
    }
}
