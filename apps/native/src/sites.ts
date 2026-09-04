import { CapacitorHttp } from "@capacitor/core"
import { Preferences } from "@capacitor/preferences"
import { DEFAULT_SITE_KEY } from "@raven/lib/utils/nativeKeys"
import { signOut } from "./auth"
import { unsubscribeSitePush } from "./push"
import { RavenShell } from "./shell"

export type Site = { url: string; name: string; clientId?: string; logo?: string }
export type SiteInfo = { url: string; name: string; clientId?: string; logo?: string }

const SITES_KEY = "sites"

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

type JsonResponse = { ok: boolean; json: () => Promise<any>; url?: string }

// Native request: the picker page is capacitor://localhost, and real sites send no CORS headers.
export const nativeGetJson = async (url: string): Promise<JsonResponse> => {
    const res = await CapacitorHttp.get({ url, connectTimeout: 8000, readTimeout: 8000 })
    // res.url is the final URL after redirects.
    return { ok: res.status >= 200 && res.status < 300, json: async () => res.data, url: res.url }
}

const originOf = (url: string | undefined): string | null => {
    if (!url) return null
    try { return new URL(url).origin } catch { return null }
}

export const validateSite = async (url: string, getJson = nativeGetJson): Promise<SiteInfo | null> => {
    let name: string
    let origin = url
    try {
        const res = await getJson(`${url}/api/method/raven.api.login.get_context`)
        if (!res.ok) return null
        // Save the origin the site answers from (apex → www, http → https): the
        // navigation gate matches origins exactly, redirects included.
        origin = originOf(res.url) ?? url
        const body = await res.json()
        name = body?.message?.app_name ?? "Raven"
    } catch {
        return null
    }
    let clientId: string | undefined
    let logo: string | undefined
    try {
        // OAuth is optional; a missing client id just falls back to the site login page.
        const res = await getJson(`${origin}/api/method/raven.api.raven_mobile.get_client_id`)
        if (res.ok) {
            const message = (await res.json())?.message
            // Sites without native_auth (older Raven) advertise no native_login:
            // keep them on the web login page instead of an OAuth flow that cannot complete.
            clientId = (message?.native_login && message?.client_id) || undefined
            logo = message?.logo || undefined
            name = message?.app_name || name
        }
    } catch {
        // Ignore: no OAuth client id on this site.
    }
    return { url: origin, name, clientId, logo }
}

export const loadSites = async (): Promise<Site[]> => {
    const { value } = await Preferences.get({ key: SITES_KEY })
    if (!value) return []
    try { return JSON.parse(value) as Site[] } catch { return [] }
}

// The native navigation gate and bridge injection follow the saved list.
const syncShell = () => RavenShell.syncAllowedOrigins().catch(() => { })

export const saveSite = async (site: Site) => {
    const sites = (await loadSites()).filter((s) => s.url !== site.url)
    await Preferences.set({ key: SITES_KEY, value: JSON.stringify([site, ...sites]) })
    await syncShell()
}

/** Forgets a site along with its push row and OAuth tokens; a push for a forgotten site would open in the browser. */
export const removeSite = async (url: string) => {
    const sites = (await loadSites()).filter((s) => s.url !== url)
    await Preferences.set({ key: SITES_KEY, value: JSON.stringify(sites) })
    await syncShell()
    if ((await getDefaultSite()) === url) await setDefaultSite(null)
    // Unsubscribe needs the access token, so it runs before the revoke.
    await unsubscribeSitePush(url)
    await signOut(url)
}

export const getDefaultSite = async () => (await Preferences.get({ key: DEFAULT_SITE_KEY })).value
export const setDefaultSite = async (url: string | null) =>
    url ? Preferences.set({ key: DEFAULT_SITE_KEY, value: url }) : Preferences.remove({ key: DEFAULT_SITE_KEY })

