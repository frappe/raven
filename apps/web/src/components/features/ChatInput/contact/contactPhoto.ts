const MAX_SIDE = 256
const JPEG_QUALITY = 0.85
const FILE_NAME = "contact.jpg"

export type SquareCrop = { sx: number; sy: number; side: number; out: number }

/** The biggest centred square, capped at `max` on both axes so small photos never upscale. */
export const squareCrop = (width: number, height: number, max = MAX_SIDE): SquareCrop => {
    const side = Math.min(width, height)
    return {
        sx: Math.floor((width - side) / 2),
        sy: Math.floor((height - side) / 2),
        side,
        out: Math.min(side, max),
    }
}

/** `source` as a Blob; a string is bare base64, without a data-URL prefix. */
export const photoBlob = async (source: Blob | string): Promise<Blob> => {
    if (typeof source !== "string") return source
    const bytes = Uint8Array.from(atob(source), (character) => character.charCodeAt(0))
    return new Blob([bytes])
}

/** Frappe rejects WebP for users without desk access, so the photo is always a JPEG. */
export const contactPhotoFile = (blob: Blob): File => new File([blob], FILE_NAME, { type: "image/jpeg" })

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY))

/** A 256 px JPEG of the contact's photo, or null when any decode, draw or encode step fails. */
export const renderContactPhoto = async (source: Blob | string): Promise<File | null> => {
    let bitmap: ImageBitmap | null = null
    try {
        bitmap = await createImageBitmap(await photoBlob(source))
        const crop = squareCrop(bitmap.width, bitmap.height)
        const canvas = document.createElement("canvas")
        canvas.width = crop.out
        canvas.height = crop.out
        const context = canvas.getContext("2d")
        if (!context) return null
        // JPEG has no alpha: transparent pixels would encode black.
        context.fillStyle = "#fff"
        context.fillRect(0, 0, crop.out, crop.out)
        context.drawImage(bitmap, crop.sx, crop.sy, crop.side, crop.side, 0, 0, crop.out, crop.out)
        const blob = await toBlob(canvas)
        return blob ? contactPhotoFile(blob) : null
    } catch {
        return null
    } finally {
        bitmap?.close()
    }
}
