import { CapacitorHttp } from "@capacitor/core"
import { Preferences } from "@capacitor/preferences"

export type Site = { url: string; name: string; clientId?: string; logo?: string }

const SITES_KEY = "sites"
const DEFAULT_SITE_KEY = "defaultSite"
export const PENDING_OPEN_KEY = "pendingOpen"

export const normalizeSiteUrl = (input: string): string | null => {
    const trimmed = input.trim()
    if (!trimmed) return null
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    try {
        const url = new URL(withScheme)
        return url.origin
    } catch {
        return null
    }
}

// Native request: the picker page is capacitor://localhost, and real sites send no CORS headers.
export const nativeGetJson = async (url: string): Promise<{ ok: boolean; json: () => Promise<any> }> => {
    const res = await CapacitorHttp.get({ url, connectTimeout: 8000, readTimeout: 8000 })
    return { ok: res.status >= 200 && res.status < 300, json: async () => res.data }
}

export const validateSite = async (url: string, getJson = nativeGetJson): Promise<{ name: string; clientId?: string; logo?: string } | null> => {
    let name: string
    try {
        const res = await getJson(`${url}/api/method/raven.api.login.get_context`)
        if (!res.ok) return null
        const body = await res.json()
        name = body?.message?.app_name ?? "Raven"
    } catch {
        return null
    }
    let clientId: string | undefined
    let logo: string | undefined
    try {
        // OAuth is optional; a missing client id just falls back to the site login page.
        const res = await getJson(`${url}/api/method/raven.api.raven_mobile.get_client_id`)
        if (res.ok) {
            const message = (await res.json())?.message
            // Sites without native_auth (older Raven) advertise no native_login:
            // keep them on the web login page instead of a doomed OAuth dance.
            clientId = (message?.native_login && message?.client_id) || undefined
            logo = message?.logo || undefined
            name = message?.app_name || name
        }
    } catch {
        // Ignore: no OAuth client id on this site.
    }
    return { name, clientId, logo }
}

export const loadSites = async (): Promise<Site[]> => {
    const { value } = await Preferences.get({ key: SITES_KEY })
    if (!value) return []
    try { return JSON.parse(value) as Site[] } catch { return [] }
}

export const saveSite = async (site: Site) => {
    const sites = (await loadSites()).filter((s) => s.url !== site.url)
    await Preferences.set({ key: SITES_KEY, value: JSON.stringify([site, ...sites]) })
}

export const removeSite = async (url: string) => {
    const sites = (await loadSites()).filter((s) => s.url !== url)
    await Preferences.set({ key: SITES_KEY, value: JSON.stringify(sites) })
    if ((await getDefaultSite()) === url) await setDefaultSite(null)
}

export const getDefaultSite = async () => (await Preferences.get({ key: DEFAULT_SITE_KEY })).value
export const setDefaultSite = async (url: string | null) =>
    url ? Preferences.set({ key: DEFAULT_SITE_KEY, value: url }) : Preferences.remove({ key: DEFAULT_SITE_KEY })

export const takePendingOpen = async (): Promise<string | null> => {
    const { value } = await Preferences.get({ key: PENDING_OPEN_KEY })
    if (value) await Preferences.remove({ key: PENDING_OPEN_KEY })
    return value
}
