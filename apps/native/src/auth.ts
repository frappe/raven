import { CapacitorHttp } from "@capacitor/core"
import { Browser } from "@capacitor/browser"
import { App } from "@capacitor/app"
import { SplashScreen } from "@capacitor/splash-screen"
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin"
import { codeChallengeS256, randomString } from "./pkce"
import { disarmSplashFallback } from "./splash"

// Host segment is required: Foundation parses "scheme:?code=…" with a nil query.
export const REDIRECT_URL = "raven.thecommit.company://oauth"
export const SCOPE = "all openid"
export type StoredTokens = { accessToken: string; refreshToken?: string; expiresAt: number }
export type Callback = { code?: string; state?: string; error?: string; error_description?: string }

export const buildAuthorizeUrl = (site: string, clientId: string, state: string, challenge: string): string => {
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        scope: SCOPE,
        redirect_uri: REDIRECT_URL,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
    })
    return `${site}/api/method/frappe.integrations.oauth2.authorize?${params.toString()}`
}

export const parseCallback = (url: string): Callback | null => {
    // Custom schemes do not survive URL.host parsing; match the prefix manually.
    const beforeFragment = url.split("#")[0]
    const [base, queryPart] = beforeFragment.split("?")
    if (base !== REDIRECT_URL && base !== `${REDIRECT_URL}/`) return null
    if (queryPart === undefined) return {}
    const query = new URLSearchParams(queryPart)
    const callback: Callback = {}
    for (const field of ["code", "state", "error", "error_description"] as const) {
        if (query.has(field)) callback[field] = query.get(field) ?? undefined
    }
    return callback
}

const key = (site: string) => `raven.tokens.${site}`

export const tokenStore = {
    async get(site: string): Promise<StoredTokens | null> {
        try {
            const { value } = await SecureStoragePlugin.get({ key: key(site) })
            const parsed = JSON.parse(value) as StoredTokens
            if (typeof parsed?.accessToken !== "string") return null
            if (parsed.refreshToken !== undefined && typeof parsed.refreshToken !== "string") return null
            return parsed
        } catch {
            return null
        }
    },
    async set(site: string, tokens: StoredTokens) {
        await SecureStoragePlugin.set({ key: key(site), value: JSON.stringify(tokens) })
    },
    async remove(site: string) {
        await SecureStoragePlugin.remove({ key: key(site) }).catch(() => { })
    },
}

// Top-level POST: no CORS, the token stays out of the URL, and the response's
// sid cookie lands in the WebView before it follows the redirect to /raven.
export const loginWithToken = (site: string, accessToken: string, redirectTo = "/raven", doc: Document = document) => {
    const form = doc.createElement("form")
    form.method = "post"
    form.action = `${site}/api/method/raven.api.native_auth.login_with_token`
    for (const [name, value] of [["access_token", accessToken], ["redirect_to", redirectTo]]) {
        const input = doc.createElement("input")
        input.type = "hidden"
        input.name = name
        input.value = value
        form.appendChild(input)
    }
    doc.body.appendChild(form)
    form.submit()
    form.remove()
}

const fromResponse = (r: { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number }, prev?: StoredTokens | null): StoredTokens => ({
    accessToken: r.access_token ?? "",
    refreshToken: r.refresh_token ?? prev?.refreshToken,
    // The token endpoint emits expires_in; expires_at (ms epoch) may come from elsewhere.
    expiresAt: r.expires_at ? Number(r.expires_at) : Date.now() + (r.expires_in ?? 3600) * 1000,
})

export type AuthDeps = {
    openBrowser: (url: string) => Promise<void>
    closeBrowser: () => Promise<void>
    onAppUrlOpen: (handler: (url: string) => void) => Promise<() => void>
    onBrowserFinished: (handler: () => void) => Promise<() => void>
    post: (url: string, form: Record<string, string>) => Promise<{ status: number; data: any }>
    store: typeof tokenStore
    navigate: (url: string) => void
    login: typeof loginWithToken
    // Covers the picker from callback until the web app hides the splash.
    progress: { show: () => void; hide: () => Promise<void> }
    pkce: { verifier: () => string; challenge: (v: string) => Promise<string>; state: () => string }
}

export const defaultDeps: AuthDeps = {
    openBrowser: (url) => Browser.open({ url }),
    closeBrowser: () => Browser.close(),
    onAppUrlOpen: async (handler) => {
        const handle = await App.addListener("appUrlOpen", (e) => handler(e.url))
        return () => { handle.remove().catch(() => { }) }
    },
    onBrowserFinished: async (handler) => {
        const handle = await Browser.addListener("browserFinished", () => handler())
        return () => { handle.remove().catch(() => { }) }
    },
    post: async (url, form) => {
        const res = await CapacitorHttp.post({
            url,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data: form,
        })
        return { status: res.status, data: res.data }
    },
    store: tokenStore,
    navigate: (url) => { window.location.href = url },
    login: loginWithToken,
    progress: {
        // Native timer survives the navigation away from this page: a failed
        // remote load can strand the splash for at most showDuration.
        show: () => {
            // The boot fallback would hide this splash mid-login. Not awaited:
            // with autoHide the plugin only resolves once the splash is gone.
            disarmSplashFallback()
            SplashScreen.show({ autoHide: true, showDuration: 15000 }).catch(() => { })
        },
        hide: () => SplashScreen.hide().catch(() => { }),
    },
    pkce: { verifier: () => randomString(32), challenge: codeChallengeS256, state: () => randomString(16) },
}

export const signIn = async (site: string, clientId: string, redirectTo = "/raven", deps: AuthDeps = defaultDeps) => {
    const verifier = deps.pkce.verifier()
    const state = deps.pkce.state()
    const challenge = await deps.pkce.challenge(verifier)

    // Listen before opening the browser: the redirect can arrive instantly.
    let settled = false
    let removeUrl: (() => void) | null = null
    let removeFinished: (() => void) | null = null
    let resolveCallback: (cb: Callback) => void = () => { }
    let rejectCallback: (e: Error) => void = () => { }
    const callbackPromise = new Promise<Callback>((resolve, reject) => { resolveCallback = resolve; rejectCallback = reject })
    const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
        removeUrl?.()
        removeFinished?.()
    }

    removeUrl = await deps.onAppUrlOpen((url) => {
        if (settled) return
        const cb = parseCallback(url)
        if (!cb || cb.state !== state) return
        if (cb.error) { finish(() => rejectCallback(new Error(cb.error_description || cb.error))); return }
        if (!cb.code) { finish(() => rejectCallback(new Error("Callback carried no authorization code"))); return }
        finish(() => resolveCallback(cb))
    })
    removeFinished = await deps.onBrowserFinished(() => {
        if (settled) return
        // The redirect can arrive just after the sheet closes on iOS.
        setTimeout(() => {
            if (!settled) finish(() => rejectCallback(new Error("Sign-in was cancelled")))
        }, 750)
    })
    try {
        await deps.openBrowser(buildAuthorizeUrl(site, clientId, state, challenge))
    } catch (e) {
        finish(() => rejectCallback(e as Error))
    }
    let callback: Callback
    try {
        callback = await callbackPromise
    } catch (e) {
        await deps.closeBrowser().catch(() => { })
        throw e
    }
    // Splash goes up beneath the browser so its dismissal never reveals the picker.
    deps.progress.show()
    await deps.closeBrowser().catch(() => { })

    let tokens: StoredTokens
    try {
        const res = await deps.post(`${site}/api/method/frappe.integrations.oauth2.get_token`, {
            grant_type: "authorization_code",
            code: callback.code ?? "",
            client_id: clientId,
            redirect_uri: REDIRECT_URL,
            code_verifier: verifier,
        })
        const data = res.data as { access_token?: string; error?: string }
        if (res.status < 200 || res.status >= 300 || !data?.access_token) {
            throw new Error(data?.error || "Token exchange failed")
        }
        tokens = fromResponse(data)
        await deps.store.set(site, tokens)
    } catch (e) {
        await deps.progress.hide()
        throw e
    }
    deps.login(site, tokens.accessToken, redirectTo)
}

export type ReauthPlan = "refresh" | "signin" | "site-login"
export const decideReauth = (tokens: StoredTokens | null, clientId?: string): ReauthPlan =>
    tokens?.refreshToken && clientId ? "refresh" : clientId ? "signin" : "site-login"

export const reauth = async (site: string, to: string, clientId?: string, deps: AuthDeps = defaultDeps) => {
    const tokens = await deps.store.get(site)
    const plan = decideReauth(tokens, clientId)
    if (plan === "site-login") {
        deps.navigate(`${site}/login?redirect-to=${encodeURIComponent(to)}`)
        return
    }
    if (plan === "refresh") {
        // decideReauth only picks refresh when a client id is present.
        const cid = clientId!
        let next: StoredTokens
        deps.progress.show()
        try {
            const res = await deps.post(`${site}/api/method/frappe.integrations.oauth2.get_token`, {
                grant_type: "refresh_token",
                refresh_token: tokens!.refreshToken!,
                client_id: cid,
            })
            const data = res.data as { access_token?: string; error?: string }
            if (res.status < 200 || res.status >= 300 || !data?.access_token) throw new Error(data?.error || "Refresh failed")
            next = fromResponse(data, tokens)
        } catch {
            // The browser is about to open; a lingering splash would hide the picker on cancel.
            await deps.progress.hide()
            await deps.store.remove(site)
            await signIn(site, cid, to, deps)
            return
        }
        await deps.store.set(site, next)
        deps.login(site, next.accessToken, to)
        return
    }
    await signIn(site, clientId!, to, deps)
}

export const signOut = async (site: string, deps: AuthDeps = defaultDeps) => {
    const tokens = await deps.store.get(site)
    await deps.store.remove(site)
    if (!tokens) return
    // Best effort; the session cookie is already gone by the time we get here.
    const revoke = (token: string, hint: string) =>
        deps.post(`${site}/api/method/frappe.integrations.oauth2.revoke_token`, { token, token_type_hint: hint }).catch(() => { })
    if (tokens.refreshToken) await revoke(tokens.refreshToken, "refresh_token")
    await revoke(tokens.accessToken, "access_token")
}
