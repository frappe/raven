import { isRejectedExchange, refreshTokens, tokenStore, type StoredTokens } from "./auth"
import { pendingRelogin } from "./pending"
import { setDefaultSite, type Site } from "./sites"

export type ActiveSession = { site: Site; getToken: () => string }

export type SessionDeps = {
    getTokens: (url: string) => Promise<StoredTokens | null>
    refresh: (url: string, clientId: string) => Promise<StoredTokens>
    now: () => number
}

const defaultDeps: SessionDeps = {
    getTokens: (url) => tokenStore.get(url),
    refresh: (url, clientId) => refreshTokens(url, clientId),
    now: () => Date.now(),
}

// Refresh this close to expiry rather than risk a 401 mid-request.
const EXPIRY_MARGIN_MS = 5 * 60_000
// An expired token with the site unreachable: try again at this pace, not in a tight loop.
const RETRY_MS = 30_000

// Only the access token stays in memory; the refresh token is read from the keychain when needed.
type Access = Pick<StoredTokens, "accessToken" | "expiresAt">
const access = ({ accessToken, expiresAt }: StoredTokens): Access => ({ accessToken, expiresAt })

let current: { site: Site; tokens: Access; deps: SessionDeps } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
type Refresh = "ok" | "rejected" | "unreachable"
let refreshing: Promise<Refresh> | null = null
let sessionLost: () => void = () => { }
let tokenRefreshed: (token: string) => void = () => { }

export const setSessionLostHandler = (fn: () => void) => { sessionLost = fn }
/** Called with the new access token after every successful refresh (the socket re-arms with it). */
export const setTokenRefreshedHandler = (fn: (token: string) => void) => { tokenRefreshed = fn }

export const activeSession = (): ActiveSession | null =>
    current ? { site: current.site, getToken: () => current!.tokens.accessToken } : null

const schedule = () => {
    clearTimeout(timer)
    if (!current) return
    const lifetime = current.tokens.expiresAt - current.deps.now()
    timer = setTimeout(() => { refreshNow() }, lifetime > 0 ? lifetime * 0.8 : RETRY_MS)
}

/** One refresh at a time. "rejected" is the site's word; "unreachable" keeps the stale tokens. */
const refreshNow = (): Promise<Refresh> => {
    if (refreshing) return refreshing
    if (!current) return Promise.resolve("rejected")
    const { site, deps } = current
    refreshing = deps.refresh(site.url, site.clientId)
        .then((tokens): Refresh => {
            if (current?.site.url === site.url) { current.tokens = access(tokens); schedule() }
            tokenRefreshed(tokens.accessToken)
            return "ok"
        })
        .catch((e): Refresh => {
            if (isRejectedExchange(e)) return "rejected"
            // The site did not answer: the tokens stand, and the next try is scheduled.
            if (current?.site.url === site.url) schedule()
            return "unreachable"
        })
        .finally(() => { refreshing = null })
    return refreshing
}

/** null without tokens; "rejected" when the site refused to renew them; else the session, stale tokens included. */
export const startSession = async (site: Site, deps: SessionDeps = defaultDeps): Promise<ActiveSession | "rejected" | null> => {
    endSession()
    const tokens = await deps.getTokens(site.url)
    if (!tokens) return null
    current = { site, tokens: access(tokens), deps }
    if (tokens.expiresAt - deps.now() < EXPIRY_MARGIN_MS && (await refreshNow()) === "rejected") {
        current = null
        return "rejected"
    }
    schedule()
    return activeSession()
}

/** Global request error hook: one refresh per 401 burst; a refusal ends the session, an outage does not. */
export const onRequestError = (error: { httpStatus?: number }) => {
    if (error?.httpStatus !== 401 || !current) return
    refreshNow().then((result) => {
        if (result !== "rejected" || !current) return
        endSession()
        sessionLost()
    })
}

export const endSession = () => {
    clearTimeout(timer)
    current = null
}

/** Back to the picker with the session kept; the reload resets every store. */
export const switchSite = async () => {
    await setDefaultSite(null)
    window.location.replace("/")
}

/** A revoked session: forget the tokens, then the picker signs this site in again on its own. */
export const reloginAt = async (url: string) => {
    endSession()
    await tokenStore.remove(url)
    await pendingRelogin.set(url)
    await setDefaultSite(null)
    window.location.replace("/")
}
