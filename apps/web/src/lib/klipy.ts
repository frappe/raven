/**
 * KLIPY GIF API, called from the browser. KLIPY's rules forbid proxying, reordering results
 * and rewriting media URLs: https://docs.klipy.com/integration-requirements
 */

const API_BASE = "https://api.klipy.com/api/v1"
const PER_PAGE = 24
/** A request KLIPY hasn't answered by now is treated as failed. */
const TIMEOUT_MS = 10_000

/** KLIPY's media delivery hosts, from its network requirements. */
const KLIPY_MEDIA_HOSTS = ["static.klipy.com", "static1.klipy.com", "static2.klipy.com"]

export type KlipyMedia = { url: string; width: number; height: number; size?: number }

type KlipySize = "hd" | "md" | "sm" | "xs"
type KlipyFormat = "gif" | "webp" | "jpg" | "mp4" | "webm"

export type KlipyGif = {
    id: number
    slug: string
    title?: string
    type: string
    file: Partial<Record<KlipySize, Partial<Record<KlipyFormat, KlipyMedia>>>>
}

export type KlipyPage = { items: KlipyGif[]; hasNext: boolean }

/** The trending and search response body. */
type KlipyListResponse = { data?: { data?: KlipyGif[]; has_next?: boolean } }

/** `status` is KLIPY's HTTP status (429 = rate limited); 0 means no answer (offline, timeout) or no key. */
export class KlipyError extends Error {
    status: number

    constructor(status: number) {
        super(`KLIPY request failed (${status})`)
        this.name = "KlipyError"
        this.status = status
    }
}

/** The site's key and this user's KLIPY id, from boot. Null when GIFs are off. */
export const getKlipyConfig = (): { apiKey: string; customerId?: string } | null => {
    const boot = window.frappe?.boot
    const apiKey = boot?.klipy_api_key as string | undefined
    if (!apiKey) return null
    return { apiKey, customerId: boot?.raven_klipy_customer_id as string | undefined }
}

export const isKlipyMediaUrl = (src: string): boolean => {
    try {
        const url = new URL(src)
        return url.protocol === "https:" && KLIPY_MEDIA_HOSTS.includes(url.hostname)
    } catch {
        return false
    }
}

/** WebP is much smaller than GIF at the same dimensions. */
export const pickMedia = (gif: KlipyGif, size: "md" | "sm"): KlipyMedia | undefined => {
    const formats = gif.file?.[size]
    return formats?.webp ?? formats?.gif
}

/** A grid tile's media: only for a GIF that can be sent, with both files on KLIPY's hosts. */
export const pickPreview = (gif: KlipyGif): KlipyMedia | undefined => {
    const preview = pickMedia(gif, "sm")
    const sent = pickMedia(gif, "md")
    return preview && sent && isKlipyMediaUrl(preview.url) && isKlipyMediaUrl(sent.url) ? preview : undefined
}

const escapeAttribute = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** KLIPY's JSON is untrusted: only a positive number becomes a size attribute. */
const sizeAttribute = (name: string, value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? [`${name}="${Math.round(value)}"`] : []

/** The message HTML for a sent GIF. The URL goes in exactly as KLIPY returned it. */
export const buildGifHtml = (gif: KlipyGif): string | null => {
    const media = pickMedia(gif, "md")
    if (!media || !isKlipyMediaUrl(media.url)) return null
    const attributes = [
        `data-type="gif"`,
        `src="${escapeAttribute(media.url)}"`,
        `alt="${escapeAttribute(gif.title ?? "")}"`,
        ...sizeAttribute("width", media.width),
        ...sizeAttribute("height", media.height),
        `data-klipy-slug="${escapeAttribute(gif.slug)}"`,
    ]
    return `<p><img ${attributes.join(" ")}></p>`
}

/** KLIPY's locale is an ISO 3166 country code: the region of a BCP 47 tag. */
export const localeFromLanguage = (lang?: string): string | undefined => {
    const region = lang?.split("-")[1]
    return region ? region.toLowerCase() : undefined
}

export const fetchGifs = async ({ query, page }: { query: string; page: number }): Promise<KlipyPage> => {
    const config = getKlipyConfig()
    if (!config) throw new KlipyError(0)

    const q = query.trim()
    const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) })
    if (q) params.set("q", q)
    if (config.customerId) params.set("customer_id", config.customerId)
    const locale = localeFromLanguage(navigator.language)
    if (locale) params.set("locale", locale)

    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
    try {
        const url = `${API_BASE}/${encodeURIComponent(config.apiKey)}/gifs/${q ? "search" : "trending"}?${params}`
        const response = await fetch(url, { signal: abort.signal }).catch(() => { throw new KlipyError(0) })
        if (!response.ok) throw new KlipyError(response.status)
        // A captive portal or proxy can answer 200 with an HTML page.
        const body: KlipyListResponse = await response.json().catch(() => { throw new KlipyError(response.status) })
        return { items: body.data?.data ?? [], hasNext: !!body.data?.has_next }
    } finally {
        clearTimeout(timer)
    }
}

/** Tells KLIPY a GIF was sent, which tunes its ranking. Best effort. */
export const registerShare = (slug: string, query: string): void => {
    const config = getKlipyConfig()
    if (!config) return
    fetch(`${API_BASE}/${encodeURIComponent(config.apiKey)}/gifs/share/${encodeURIComponent(slug)}`, {
        method: "POST",
        // Survives the user leaving the channel right after sending.
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: config.customerId, q: query.trim() }),
    }).catch(() => { })
}
