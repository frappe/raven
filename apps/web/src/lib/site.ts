import { atomWithStorage, createJSONStorage } from "jotai/utils"

type SyncStorage<T> = NonNullable<Parameters<typeof atomWithStorage<T>>[2]>

// Set once by the native entry before the first render; the browser never sets it.
let active: { origin: string; getToken: () => string } | null = null

export const setActiveSite = (origin: string, getToken: () => string) => { active = { origin, getToken } }
export const _resetActiveSite = () => { active = null }

export const siteOrigin = (): string => active?.origin ?? window.location.origin

/** The bearer for native requests made outside fetch (plugins); undefined in the browser. */
export const siteToken = (): string | undefined => active?.getToken()

const isAbsolute = (path: string) => /^(https?:|blob:|data:)/i.test(path)

/** Absolute URL on the active site for a site-relative path; identity in the browser. */
export const siteUrl = (path: string): string => (active && !isAbsolute(path) ? `${active.origin}${path}` : path)

/** localStorage key scoped to the active site; identity in the browser. */
export const siteKey = (name: string): string => (active ? `${active.origin}|${name}` : name)

/** The path segment the site serves Raven under; the native router runs at / but the site does not. */
export const siteBaseName = (): string => (active ? "raven" : import.meta.env.VITE_BASE_NAME ?? "")

// Absent in the node test runner, where module-scope atoms still get created.
const local = () => (typeof localStorage === "undefined" ? undefined : localStorage)

/** jotai storage for atomWithStorage: keys are scoped per call, so module-scope atoms work. */
export const siteStorage = <T,>(): SyncStorage<T> =>
    createJSONStorage<T>(() => ({
        getItem: (key) => local()?.getItem(siteKey(key)) ?? null,
        setItem: (key, value) => local()?.setItem(siteKey(key), value),
        removeItem: (key) => local()?.removeItem(siteKey(key)),
        // jotai only wires cross-tab `storage` events for a real Storage; do it for the scoped key.
        subscribe: (key, callback) => {
            if (typeof window === "undefined") return () => { }
            const onStorage = (e: StorageEvent) => { if (e.storageArea === local() && e.key === siteKey(key)) callback(e.newValue) }
            window.addEventListener("storage", onStorage)
            return () => window.removeEventListener("storage", onStorage)
        },
    }))

/** On every request from the app: the site allows the app's origins only when this header is present. */
export const APP_HEADERS = { "X-Raven-App": "1" } as const

/** fetch against the site: bearer token in native, session cookies in the browser. */
export const siteFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = { ...(init.headers as Record<string, string> | undefined) }
    const url = siteUrl(path)
    // The bearer is for the site alone: an absolute url elsewhere goes without it.
    if (active && url.startsWith(`${active.origin}/`)) Object.assign(headers, APP_HEADERS, { Authorization: `Bearer ${active.getToken()}` })
    return fetch(url, active ? { ...init, headers } : { ...init, credentials: "include", headers })
}

/** A site-relative or site-absolute path under /private/files/, which needs the token. */
export const isPrivateFile = (path: string): boolean => path.replace(siteOrigin(), "").startsWith("/private/files/")
