import { siteFetch, siteKey, siteToken, siteUrl } from "@lib/site"
import { setSessionUser } from "@lib/sessionUser"

const CACHE_KEY = "raven-boot-cache"
const BOOT_TIMEOUT_MS = 8000

/** The fields of Frappe's session boot this module reads; the rest passes through untouched. */
type Boot = {
    user?: { name?: string }
    user_info?: Record<string, { fullname?: string; image?: string | null }>
    __messages?: Record<string, string>
}

const install = (boot: Boot) => {
    if (!window.frappe) window.frappe = {}
    window.frappe.boot = boot
    window.frappe._messages = boot.__messages ?? {}
    const name = boot.user?.name ?? ""
    const info = boot.user_info?.[name] ?? {}
    setSessionUser({ name, fullName: info.fullname ?? name, image: info.image ?? "" })
}

export type BootStatus = "ok" | "offline" | "unreachable" | "unauthorized" | "maintenance" | "unavailable"

const statusOf = (httpStatus: number): BootStatus =>
    httpStatus === 401 || httpStatus === 403 ? "unauthorized" : httpStatus === 503 ? "maintenance" : "unavailable"

// Frappe answers a site in maintenance before its CORS hook runs, so the page's fetch throws on
// that 503. The native stack has no CORS: it reads the status the fetch could not. 0 when no answer.
const nativeStatus = async (): Promise<number> => {
    try {
        const { CapacitorHttp } = await import("@capacitor/core")
        const res = await CapacitorHttp.get({ url: siteUrl("/api/method/raven.api.native.boot"), headers: { Authorization: `Bearer ${siteToken()}` }, connectTimeout: 8000, readTimeout: 8000 })
        return res.status
    } catch {
        return 0
    }
}

/** Boot from the site, else the last good copy for this site when the site gave no answer at all. */
export const loadBoot = async (): Promise<BootStatus> => {
    let res: Response
    let body: { message: Boot } | undefined
    // Nothing renders until this settles: a network that swallows the request must not hold the launch screen.
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), BOOT_TIMEOUT_MS)
    try {
        res = await siteFetch("/api/method/raven.api.native.boot", { signal: abort.signal })
        // Inside the timeout too: a connection can stall after the headers.
        if (res.ok) body = (await res.json()) as { message: Boot }
    } catch {
        const cached = localStorage.getItem(siteKey(CACHE_KEY))
        if (cached) { install(JSON.parse(cached) as Boot); return "ok" }
        if (navigator.onLine === false) return "offline"
        const status = await nativeStatus()
        // No answer with the device online is the site's fault: down, or its address changed.
        return status === 0 ? "unreachable" : status === 200 ? "unavailable" : statusOf(status)
    } finally {
        clearTimeout(timer)
    }
    // An HTTP answer is the site's word; the cache must not paper over a revoked session.
    if (!body) return statusOf(res.status)
    const { message } = body
    install(message)
    try { localStorage.setItem(siteKey(CACHE_KEY), JSON.stringify(message)) } catch { /* quota */ }
    return "ok"
}
