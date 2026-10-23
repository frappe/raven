import { siteFetch } from "@lib/site"

type Boot = { lang?: string; __messages?: Record<string, string>; translations_version?: string }

/**
 * Puts the user's translations where `_()` reads them. Frappe 15 and 16 ship them in the boot
 * as `__messages`. Frappe develop ships only a version stamp and serves the table from
 * `get_boot_translations`, which the browser caches by that version.
 */
export const loadTranslations = async (boot: Boot): Promise<void> => {
    if (!window.frappe) window.frappe = {}
    // Before the first await, so a boot that carries the table installs it at once.
    if (boot.__messages) {
        window.frappe._messages = boot.__messages
        return
    }
    window.frappe._messages = boot.translations_version ? await fetchTranslations(boot) : {}
}

const fetchTranslations = async (boot: Boot): Promise<Record<string, string>> => {
    const params = new URLSearchParams({ v: boot.translations_version ?? "", lang: boot.lang ?? "" })
    try {
        const res = await siteFetch(`/api/method/frappe.translate.get_boot_translations?${params}`, { headers: { Accept: "application/json" } })
        if (!res.ok) return {}
        const body = (await res.json()) as { message?: Record<string, string> }
        return body.message ?? {}
    } catch {
        // Offline, or the site is unreachable: the source strings show.
        return {}
    }
}
