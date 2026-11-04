import { useState, type CSSProperties } from "react"
import { isKlipyMediaUrl } from "@lib/klipy"
import _ from "@lib/translate"
import { fitImageBox } from "./ReservedImage"

/** A stored width/height attribute as a positive number, else undefined. */
const positiveSize = (value?: string): number | undefined => {
    const size = Number(value)
    return Number.isFinite(size) && size > 0 ? size : undefined
}

/** Same box as the GIF, so one that fails to load (offline, blocked) leaves the row's height alone. KLIPY serves its own image for a removed GIF. */
export const GifUnavailable = ({ style }: { style: CSSProperties }) => (
    <span
        role="img"
        aria-label={_("GIF unavailable")}
        className="my-1 flex max-w-full items-center justify-center rounded-md bg-surface-gray-2 text-sm text-ink-gray-5"
        style={style}
    >
        {_("GIF unavailable")}
    </span>
)

/**
 * A GIF from its stored <img> attributes. Renders nothing unless the src is on a KLIPY media host;
 * the URL is used as stored. Width + aspect ratio fix the box before the GIF loads.
 */
export const GifImage = ({ src = "", alt = "", width, height }: { src?: string; alt?: string; width?: string; height?: string }) => {
    const [failed, setFailed] = useState(false)
    if (!isKlipyMediaUrl(src)) return null
    const box = fitImageBox(positiveSize(width), positiveSize(height))
    if (failed) return <GifUnavailable style={box} />
    return <img src={src} alt={alt} loading="lazy" decoding="async" className="gif" style={box} onError={() => setFailed(true)} />
}
