import { tilesFor, type LocationMeta, type MapTile } from "@lib/location"
import { PIN_COLOR, PIN_DOT, PIN_HEIGHT, PIN_PATH, PIN_WIDTH } from "./pinShape"

export const SNAPSHOT_SIZE = 128
export const SNAPSHOT_TIMEOUT_MS = 5000
export const SNAPSHOT_MIN_ZOOM = 15
export const SNAPSHOT_MAX_ZOOM = 18

export type Snapshot = { file_url: string; file_size: number }
export type SnapshotDrawPlan = { tiles: MapTile[]; pin: { x: number; y: number } }

const PIN_DOT_COLOR = "#ffffff"

// Leaflet's zoom can be fractional mid-animation; tile URLs need an integer.
const clampZoom = (zoom: number): number =>
    Math.min(SNAPSHOT_MAX_ZOOM, Math.max(SNAPSHOT_MIN_ZOOM, Math.round(zoom)))

/** Tiles and pin placement for the 128 px snapshot, centred on the point. */
export const snapshotDrawPlan = (meta: LocationMeta, zoom: number): SnapshotDrawPlan => ({
    tiles: tilesFor(meta.latitude, meta.longitude, clampZoom(zoom), SNAPSHOT_SIZE, SNAPSHOT_SIZE, 256),
    pin: { x: SNAPSHOT_SIZE / 2, y: SNAPSHOT_SIZE / 2 },
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

const drawPin = (context: CanvasRenderingContext2D, x: number, y: number) => {
    context.save()
    // The path's tip sits at (14, 36); translate so the tip lands on the point.
    context.translate(x - PIN_WIDTH / 2, y - PIN_HEIGHT)
    context.fillStyle = PIN_COLOR
    context.fill(new Path2D(PIN_PATH))
    context.beginPath()
    context.arc(PIN_DOT.cx, PIN_DOT.cy, PIN_DOT.r, 0, Math.PI * 2)
    context.fillStyle = PIN_DOT_COLOR
    context.fill()
    context.restore()
}

/** Tiles then pin; the snapshot carries no text or chips. */
export const drawSnapshot = (
    context: CanvasRenderingContext2D,
    plan: SnapshotDrawPlan,
    images: HTMLImageElement[],
) => {
    plan.tiles.forEach((tile, index) => {
        context.drawImage(images[index], tile.left, tile.top, tile.size, tile.size)
    })
    drawPin(context, plan.pin.x, plan.pin.y)
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
        canvas.width = SNAPSHOT_SIZE
        canvas.height = SNAPSHOT_SIZE
        const context = canvas.getContext("2d")
        if (!context) return null
        drawSnapshot(context, plan, images)
        const blob = await toBlob(canvas)
        return blob ? fileFor(blob) : null
    } catch {
        return null
    }
}
