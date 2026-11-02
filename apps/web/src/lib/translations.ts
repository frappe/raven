import dayjs from "dayjs"
import { siteFetch } from "@lib/site"
import { loadDateLocale } from "@lib/locale"

type Boot = { lang?: string; __messages?: Record<string, string>; translations_version?: string }

/**
 * Puts the user's translations where `_()` reads them, and the date names where dayjs reads
 * them. Frappe 15 and 16 ship the table in the boot as `__messages`. Frappe develop ships only
 * a version stamp and serves the table from `get_boot_translations`, which the browser caches
 * by that version.
 */
// Calls can overlap: the native app installs a cached boot while a fresh one loads. Only the
// newest call may write, or a stale table arriving last would replace the current one.
let newest = 0

export const loadTranslations = async (boot: Boot): Promise<void> => {
    const call = ++newest
    if (!window.frappe) window.frappe = {}
    // Before the first await, so a boot that carries the table installs it at once.
    if (boot.__messages) window.frappe._messages = boot.__messages
    const [table, dateLocale] = await Promise.all([
        boot.__messages ?? (boot.translations_version ? fetchTranslations(boot) : {}),
        loadDateLocale(boot.lang),
    ])
    if (call !== newest) return
    window.frappe._messages = table
    dayjs.locale(dateLocale)
}

// Nothing renders until this settles, so a stalled connection must not hold the app.
const TRANSLATIONS_TIMEOUT_MS = 8_000

const fetchTranslations = async (boot: Boot): Promise<Record<string, string>> => {
    const params = new URLSearchParams({ v: boot.translations_version ?? "", lang: boot.lang ?? "" })
    // The signal covers the body read as well as the headers.
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), TRANSLATIONS_TIMEOUT_MS)
    try {
        const res = await siteFetch(`/api/method/frappe.translate.get_boot_translations?${params}`, { headers: { Accept: "application/json" }, signal: abort.signal })
        if (!res.ok) return {}
        const body = (await res.json()) as { message?: Record<string, string> }
        return body.message ?? {}
    } catch {
        // Offline, unreachable, or too slow: the source strings show.
        return {}
    } finally {
        clearTimeout(timer)
    }
}
