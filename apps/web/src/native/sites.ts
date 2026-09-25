import { withPrefs } from "./platform"

export type Site = {
    /** Origin the site answers from, e.g. https://raven.example.com */
    url: string
    name: string
    /** Frappe site name, the socket namespace. */
    sitename: string
    clientId: string
    logo?: string
    ravenVersion: string
    /** The site asked for a newer app; a prompt, never a block. */
    minAppVersion?: string
}

const SITES_KEY = "sites"
const DEFAULT_SITE_KEY = "defaultSite"

// A bench or LAN site has no certificate; everything else gets https unless typed otherwise.
const isLocalHost = (host: string) => /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host)

export const normalizeSiteUrl = (input: string): string | null => {
    const trimmed = input.trim()
    if (!trimmed) return null
    try {
        if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed).origin
        const url = new URL(`https://${trimmed}`)
        return isLocalHost(url.hostname) ? `http://${url.host}` : url.origin
    } catch {
        return null
    }
}

type JsonResponse = { status: number; data: unknown; url?: string }
export type GetJson = (url: string) => Promise<JsonResponse>

// Native request: no CORS, so a site older than the CORS hook still answers,
// and the failure reads as "too old" instead of a blocked fetch.
const nativeGetJson: GetJson = async (url) => {
    const { CapacitorHttp } = await import("@capacitor/core")
    const res = await CapacitorHttp.get({ url, connectTimeout: 8000, readTimeout: 8000 })
    return { status: res.status, data: res.data, url: res.url }
}

export type ProbeResult = { site: Site } | { error: "unreachable" | "not-raven" | "site-too-old" | "no-client" }

type ClientInfo = { client_id?: string | null; raven_version?: string; min_app_version?: string; sitename?: string; app_name?: string; logo?: string }

export const probeSite = async (url: string, getJson: GetJson = nativeGetJson): Promise<ProbeResult> => {
    let res: JsonResponse
    try {
        res = await getJson(`${url}/api/method/raven.api.raven_mobile.get_client_id`)
    } catch {
        return { error: "unreachable" }
    }
    // 404 and 417 are Frappe's answers for a method it does not know: a Raven older than the mobile API.
    if (res.status === 404 || res.status === 417) return { error: "site-too-old" }
    const message = (res.data as { message?: ClientInfo } | null)?.message
    if (res.status !== 200 || !message?.sitename || !message.raven_version) return { error: "not-raven" }
    if (!message.client_id) return { error: "no-client" }
    return {
        site: {
            // The origin the site answered from (apex → www, http → https).
            url: (res.url && normalizeSiteUrl(res.url)) || url,
            name: message.app_name || "Raven",
            sitename: message.sitename,
            clientId: message.client_id,
            logo: message.logo || undefined,
            ravenVersion: message.raven_version,
            minAppVersion: message.min_app_version || undefined,
        },
    }
}

export const loadSites = async (): Promise<Site[]> => {
    const { value } = await withPrefs((p) => p.get({ key: SITES_KEY }))
    let sites: Site[] = []
    try { sites = value ? (JSON.parse(value) as Site[]) : [] } catch { sites = [] }
    void tellShellSiteCount(sites.length)
    return sites
}

/** iOS names the site on a notification only when there is more than one to tell apart. */
const tellShellSiteCount = (count: number) =>
    import("./shell")
        .then(({ ravenShell }) => ravenShell())
        .then(({ plugin }) => plugin.setSiteCount({ count }))
        .catch(() => { })

const writeSites = async (sites: Site[]) => {
    await withPrefs((p) => p.set({ key: SITES_KEY, value: JSON.stringify(sites) }))
    await tellShellSiteCount(sites.length)
}

/** Front of the list: the picker shows the last used site first. */
export const saveSite = async (site: Site) => {
    await writeSites([site, ...(await loadSites()).filter((s) => s.url !== site.url)])
}

/** Drops the list entry and the default; tokens are the session module's job. */
/** Everything stored for a site: its scoped keys, its database, and the media cache all sites share. */
export const wipeSiteData = async (url: string) => {
    const prefix = `${url}|`
    Object.keys(localStorage).filter((key) => key.startsWith(prefix)).forEach((key) => localStorage.removeItem(key))
    indexedDB.deleteDatabase(`${prefix}RavenDB`)
    await import("./download").then((m) => m.clearMediaCache()).catch(() => { })
    await import("./push").then((m) => m.forgetPushPreference(url)).catch(() => { })
}

export const forgetSite = async (url: string) => {
    await writeSites((await loadSites()).filter((s) => s.url !== url))
    if ((await getDefaultSite()) === url) await setDefaultSite(null)
}

/** Re-probes an open site and saves what changed; a guest call, so nothing is lost when it fails. */
/** Completes a record saved without the site's client info, as the shell app's are: it shares this app's id and storage. */
export const completeSite = async (site: Site, getJson: GetJson = nativeGetJson): Promise<ProbeResult> => {
    const result = await probeSite(site.url, getJson)
    // A site that answers from another origin (apex → www) is saved under it; the entry it was opened from would be a second row.
    if ("site" in result && result.site.url !== site.url) await forgetSite(site.url)
    return result
}

export const refreshSite = async (site: Site, getJson: GetJson = nativeGetJson) => {
    const result = await probeSite(site.url, getJson)
    if ("error" in result) return
    const fresh = { ...site, name: result.site.name, logo: result.site.logo, ravenVersion: result.site.ravenVersion, minAppVersion: result.site.minAppVersion }
    if (JSON.stringify(fresh) !== JSON.stringify(site)) await saveSite(fresh)
}

export const getDefaultSite = (): Promise<string | null> => withPrefs((p) => p.get({ key: DEFAULT_SITE_KEY })).then((r) => r.value)
export const setDefaultSite = (url: string | null) =>
    withPrefs((p) => (url ? p.set({ key: DEFAULT_SITE_KEY, value: url }) : p.remove({ key: DEFAULT_SITE_KEY })))
