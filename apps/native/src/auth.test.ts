import { afterEach, describe, expect, it, vi } from "vitest"
import { REDIRECT_URL, buildAuthorizeUrl, parseCallback, loginWithToken, decideReauth, signIn, reauth, signOut, type AuthDeps, type StoredTokens } from "./auth"

describe("buildAuthorizeUrl", () => {
    it("targets the authorize endpoint with the exact PKCE query", () => {
        expect(buildAuthorizeUrl("https://a.com", "CLIENT", "STATE", "CHALLENGE")).toBe(
            "https://a.com/api/method/frappe.integrations.oauth2.authorize"
            + "?client_id=CLIENT&response_type=code&scope=all+openid"
            + "&redirect_uri=raven.thecommit.company%3A%2F%2Foauth"
            + "&state=STATE&code_challenge=CHALLENGE&code_challenge_method=S256")
    })
    it("passes the challenge and redirect uri through", () => {
        const url = buildAuthorizeUrl("https://a.com", "C", "S", "X")
        const query = new URLSearchParams(url.split("?")[1])
        expect(query.get("code_challenge")).toBe("X")
        expect(query.get("code_challenge_method")).toBe("S256")
        expect(query.get("redirect_uri")).toBe(REDIRECT_URL)
    })
})

describe("parseCallback", () => {
    it("reads code and state from a matching redirect", () => {
        expect(parseCallback(`${REDIRECT_URL}?code=ABC&state=S1`)).toEqual({ code: "ABC", state: "S1" })
    })
    it("accepts a trailing slash and a query-less redirect", () => {
        expect(parseCallback(`${REDIRECT_URL}/?code=x&state=y`)).toEqual({ code: "x", state: "y" })
        expect(parseCallback(REDIRECT_URL)).toEqual({})
    })
    it("drops the fragment before parsing the query", () => {
        expect(parseCallback(`${REDIRECT_URL}?code=x&state=y#frag`)).toEqual({ code: "x", state: "y" })
    })
    it("returns null for another scheme or host", () => {
        expect(parseCallback("https://example.com/?code=ABC")).toBeNull()
        expect(parseCallback("raven.thecommit.company://other?code=x")).toBeNull()
    })
    it("reads the error fields", () => {
        expect(parseCallback(`${REDIRECT_URL}?error=access_denied&error_description=Denied`))
            .toEqual({ error: "access_denied", error_description: "Denied" })
    })
})

describe("loginWithToken", () => {
    it("posts the token as a top-level form to login_with_token", () => {
        const submit = vi.fn()
        const remove = vi.fn()
        const bodyAppend = vi.fn()
        const forms: HTMLFormElement[] = []
        const doc = {
            createElement: (tag: string) => {
                const el: any = { tag, children: [], appendChild(c: any) { this.children.push(c) } }
                if (tag === "form") { el.submit = submit; el.remove = remove; forms.push(el) }
                return el
            },
            body: { appendChild: bodyAppend },
        } as unknown as Document
        loginWithToken("https://a.com", "TOK", "/raven/ws/x", doc)
        const form = forms[0] as any
        expect(form.method).toBe("post")
        expect(form.action).toBe("https://a.com/api/method/raven.api.native_auth.login_with_token")
        const inputs = form.children.map((i: any) => [i.name, i.value, i.type])
        expect(inputs).toEqual([["access_token", "TOK", "hidden"], ["redirect_to", "/raven/ws/x", "hidden"]])
        expect(bodyAppend).toHaveBeenCalledWith(form)
        expect(submit).toHaveBeenCalled()
        expect(remove).toHaveBeenCalled()
    })
})

describe("decideReauth", () => {
    it("refreshes when a refresh token and a client id exist", () => {
        expect(decideReauth({ refreshToken: "r", accessToken: "a", expiresAt: 0 }, "CLIENT")).toBe("refresh")
    })
    it("signs in interactively with a client id but no tokens", () => {
        expect(decideReauth(null, "CLIENT")).toBe("signin")
    })
    it("falls back to the site login page without a client id", () => {
        expect(decideReauth(null, undefined)).toBe("site-login")
    })
    it("falls back to the site login page with a refresh token but no client id", () => {
        expect(decideReauth({ refreshToken: "r", accessToken: "a", expiresAt: 0 }, undefined)).toBe("site-login")
    })
})

const makeStore = () => {
    const map = new Map<string, StoredTokens>()
    return {
        map,
        get: vi.fn(async (site: string) => map.get(site) ?? null),
        set: vi.fn(async (site: string, tokens: StoredTokens) => { map.set(site, tokens) }),
        remove: vi.fn(async (site: string) => { map.delete(site) }),
    }
}

// signIn awaits deps.pkce.challenge and both listener registrations before
// opening the browser, so handlers become active only after microtask pumps
// (Promise.resolve is unaffected by vi.useFakeTimers).
const pump = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }

const makeDeps = (over: Partial<AuthDeps> = {}) => {
    const store = makeStore()
    let handler: ((url: string) => void) | null = null
    let finishedHandler: (() => void) | null = null
    const removedUrl = vi.fn()
    const removedFinished = vi.fn()
    const deps: AuthDeps = {
        openBrowser: vi.fn(async () => { }),
        closeBrowser: vi.fn(async () => { }),
        onAppUrlOpen: vi.fn(async (h: (url: string) => void) => { handler = h; return removedUrl }),
        onBrowserFinished: vi.fn(async (h: () => void) => { finishedHandler = h; return removedFinished }),
        post: vi.fn(async () => ({ status: 200, data: { access_token: "NEW", refresh_token: "R2", expires_in: 3600 } })),
        store: store as unknown as AuthDeps["store"],
        clearCookies: vi.fn(async () => { }),
        navigate: vi.fn(),
        login: vi.fn(),
        progress: { show: vi.fn(async () => { }), hide: vi.fn(async () => { }) },
        pkce: { verifier: () => "VERIFIER", challenge: vi.fn(async (v: string) => `CH-${v}`), state: () => "STATE" },
        ...over,
    }
    return { deps, store, emit: (url: string) => handler?.(url), emitFinished: () => finishedHandler?.(), removedUrl, removedFinished }
}

const TOKEN_URL = "https://a.com/api/method/frappe.integrations.oauth2.get_token"

describe("signIn", () => {
    it("runs the PKCE dance and logs in with the exchanged token", async () => {
        const { deps, store, emit, removedUrl, removedFinished } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven/x", deps)
        await pump()
        // A URL with the wrong state is ignored.
        emit(`${REDIRECT_URL}?state=WRONG&code=BAD`)
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await pending

        expect(deps.pkce.challenge).toHaveBeenCalledWith("VERIFIER")
        expect(deps.openBrowser).toHaveBeenCalledTimes(1)
        const url = (deps.openBrowser as any).mock.calls[0][0] as string
        const query = new URLSearchParams(url.split("?")[1])
        expect(query.get("code_challenge")).toBe("CH-VERIFIER")
        expect(query.get("state")).toBe("STATE")
        // Listeners registered before the browser opens.
        const openOrder = (deps.openBrowser as any).mock.invocationCallOrder[0]
        const listenOrder = (deps.onAppUrlOpen as any).mock.invocationCallOrder[0]
        const finishedOrder = (deps.onBrowserFinished as any).mock.invocationCallOrder[0]
        expect(listenOrder).toBeLessThan(openOrder)
        expect(finishedOrder).toBeLessThan(openOrder)

        expect(deps.post).toHaveBeenCalledWith(TOKEN_URL, {
            grant_type: "authorization_code", code: "CODE1", client_id: "CLIENT",
            redirect_uri: REDIRECT_URL, code_verifier: "VERIFIER",
        })
        expect(deps.closeBrowser).toHaveBeenCalledTimes(1)
        expect(removedUrl).toHaveBeenCalledTimes(1)
        expect(removedFinished).toHaveBeenCalledTimes(1)
        expect(store.set).toHaveBeenCalledWith("https://a.com", expect.objectContaining({ accessToken: "NEW", refreshToken: "R2" }))
        expect(deps.login).toHaveBeenCalledWith("https://a.com", "NEW", "/raven/x")
        expect(deps.progress.show).toHaveBeenCalledTimes(1)
        expect(deps.progress.hide).not.toHaveBeenCalled()
        const showOrder = (deps.progress.show as any).mock.invocationCallOrder[0]
        const closeOrder = (deps.closeBrowser as any).mock.invocationCallOrder[0]
        expect(showOrder).toBeLessThan(closeOrder)
    })
    it("rejects on an error callback and cleans up", async () => {
        const { deps, emit, removedUrl, removedFinished } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven", deps)
        await pump()
        emit(`${REDIRECT_URL}?state=STATE&error=access_denied&error_description=Denied`)
        await expect(pending).rejects.toThrow("Denied")
        expect(deps.progress.show).not.toHaveBeenCalled()
        expect(deps.openBrowser).toHaveBeenCalledTimes(1)
        expect(deps.closeBrowser).toHaveBeenCalledTimes(1)
        expect(removedUrl).toHaveBeenCalledTimes(1)
        expect(removedFinished).toHaveBeenCalledTimes(1)
        expect(deps.post).not.toHaveBeenCalled()
    })
    it("rejects on Frappe's deny redirect, which carries no state", async () => {
        const { deps, emit } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven/x", deps)
        await pump()
        emit(`${REDIRECT_URL}?error=access_denied`)
        await expect(pending).rejects.toThrow("access_denied")
        expect(deps.closeBrowser).toHaveBeenCalled()
        expect(deps.login).not.toHaveBeenCalled()
    })
    it("ignores a stateless error other than access_denied, then settles on the real callback", async () => {
        const { deps, emit } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven/x", deps)
        await pump()
        emit(`${REDIRECT_URL}?error=server_error`)
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await pending
        expect(deps.login).toHaveBeenCalledTimes(1)
    })
    it("clears the site's cookies before logging in", async () => {
        const { deps, emit } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven/x", deps)
        await pump()
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await pending
        expect(deps.clearCookies).toHaveBeenCalledWith("https://a.com")
        const clearOrder = (deps.clearCookies as any).mock.invocationCallOrder[0]
        const loginOrder = (deps.login as any).mock.invocationCallOrder[0]
        expect(clearOrder).toBeLessThan(loginOrder)
    })
    it("awaits the beforeLogin hook before logging in", async () => {
        const { deps, emit } = makeDeps()
        const beforeLogin = vi.fn(async () => { })
        const pending = signIn("https://a.com", "CLIENT", "/raven/x", deps, { beforeLogin })
        await pump()
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await pending
        const hookOrder = beforeLogin.mock.invocationCallOrder[0]
        const loginOrder = (deps.login as any).mock.invocationCallOrder[0]
        expect(hookOrder).toBeLessThan(loginOrder)
    })
    it("ignores an error callback with a mismatched state, then settles on the real callback", async () => {
        const { deps, store, emit } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven", deps)
        await pump()
        emit(`${REDIRECT_URL}?state=WRONG&error=access_denied&error_description=Denied`)
        const state1 = await Promise.race([pending.then(() => "settled"), new Promise<string>((r) => setTimeout(() => r("pending"), 0))])
        expect(state1).toBe("pending")
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await pending
        expect(deps.post).toHaveBeenCalledTimes(1)
        expect(store.set).toHaveBeenCalled()
    })
    it("rejects when the callback carries no code", async () => {
        const { deps, emit, removedUrl, removedFinished } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven", deps)
        await pump()
        emit(`${REDIRECT_URL}?state=STATE`)
        await expect(pending).rejects.toThrow("Callback carried no authorization code")
        expect(removedUrl).toHaveBeenCalledTimes(1)
        expect(removedFinished).toHaveBeenCalledTimes(1)
        expect(deps.post).not.toHaveBeenCalled()
    })
    it("rejects with the browser error and removes the listeners when opening fails", async () => {
        const boom = new Error("no browser")
        const { deps, removedUrl, removedFinished } = makeDeps({ openBrowser: vi.fn(async () => { throw boom }) })
        await expect(signIn("https://a.com", "CLIENT", "/raven", deps)).rejects.toThrow("no browser")
        expect(removedUrl).toHaveBeenCalledTimes(1)
        expect(removedFinished).toHaveBeenCalledTimes(1)
        expect(deps.closeBrowser).toHaveBeenCalledTimes(1)
    })
    it("rejects when the token exchange returns an error status", async () => {
        const { deps, emit, removedUrl, removedFinished } = makeDeps({ post: vi.fn(async () => ({ status: 400, data: { error: "invalid_grant" } })) })
        const pending = signIn("https://a.com", "CLIENT", "/raven", deps)
        await pump()
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await expect(pending).rejects.toThrow("invalid_grant")
        expect(removedUrl).toHaveBeenCalledTimes(1)
        expect(removedFinished).toHaveBeenCalledTimes(1)
        expect(deps.closeBrowser).toHaveBeenCalledTimes(1)
        expect(deps.progress.show).toHaveBeenCalledTimes(1)
        expect(deps.progress.hide).toHaveBeenCalledTimes(1)
    })
    it("rejects when the exchange returns no access token", async () => {
        const { deps, emit } = makeDeps({ post: vi.fn(async () => ({ status: 200, data: {} })) })
        const pending = signIn("https://a.com", "CLIENT", "/raven", deps)
        await pump()
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await expect(pending).rejects.toThrow("Token exchange failed")
        expect(deps.login).not.toHaveBeenCalled()
    })
})

describe("signIn cancel path", () => {
    afterEach(() => { vi.useRealTimers() })

    it("rejects when the browser finishes without a callback", async () => {
        vi.useFakeTimers()
        const { deps, emitFinished, removedUrl, removedFinished } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven", deps)
        await pump()
        // Attach the rejection handler before the timer fires.
        const rejection = expect(pending).rejects.toThrow("Sign-in was cancelled")
        emitFinished()
        await vi.advanceTimersByTimeAsync(750)
        await rejection
        expect(removedUrl).toHaveBeenCalledTimes(1)
        expect(removedFinished).toHaveBeenCalledTimes(1)
        expect(deps.closeBrowser).toHaveBeenCalledTimes(1)
        expect(deps.post).not.toHaveBeenCalled()
    })
    it("still succeeds when the callback arrives within the grace period", async () => {
        vi.useFakeTimers()
        const { deps, store, emit, emitFinished } = makeDeps()
        const pending = signIn("https://a.com", "CLIENT", "/raven", deps)
        await pump()
        emitFinished()
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await vi.advanceTimersByTimeAsync(750)
        await expect(pending).resolves.toBeUndefined()
        expect(deps.post).toHaveBeenCalledTimes(1)
        expect(store.set).toHaveBeenCalled()
        expect(deps.login).toHaveBeenCalledWith("https://a.com", "NEW", "/raven")
    })
})

describe("reauth", () => {
    it("refreshes the token and logs in once", async () => {
        const { deps, store } = makeDeps()
        store.map.set("https://a.com", { accessToken: "OLD", refreshToken: "RR", expiresAt: 0 })
        await reauth("https://a.com", "/raven/x", "CLIENT", deps)
        expect(deps.post).toHaveBeenCalledWith(TOKEN_URL, { grant_type: "refresh_token", refresh_token: "RR", client_id: "CLIENT" })
        expect(deps.login).toHaveBeenCalledTimes(1)
        expect(deps.login).toHaveBeenCalledWith("https://a.com", "NEW", "/raven/x")
        expect(store.set).toHaveBeenCalledWith("https://a.com", expect.objectContaining({ accessToken: "NEW", refreshToken: "R2" }))
        expect(deps.openBrowser).not.toHaveBeenCalled()
    })
    it("clears cookies and runs beforeLogin before the refreshed login", async () => {
        const { deps, store } = makeDeps()
        store.map.set("https://a.com", { accessToken: "OLD", refreshToken: "RR", expiresAt: 0 })
        const beforeLogin = vi.fn(async () => { })
        await reauth("https://a.com", "/raven/x", "CLIENT", deps, { beforeLogin })
        const loginOrder = (deps.login as any).mock.invocationCallOrder[0]
        expect((deps.clearCookies as any).mock.invocationCallOrder[0]).toBeLessThan(loginOrder)
        expect(beforeLogin.mock.invocationCallOrder[0]).toBeLessThan(loginOrder)
    })
    it("passes the hooks through to the interactive sign-in", async () => {
        const { deps, emit } = makeDeps()
        const beforeLogin = vi.fn(async () => { })
        const pending = reauth("https://a.com", "/raven/x", "CLIENT", deps, { beforeLogin })
        await pump()
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await pending
        expect(beforeLogin).toHaveBeenCalledTimes(1)
        expect(deps.login).toHaveBeenCalledTimes(1)
    })
    it("drops the tokens and signs in interactively when the refresh fails", async () => {
        const post = vi.fn(async (_url: string, form: Record<string, string>) => {
            if (form.grant_type === "refresh_token") throw new Error("net")
            return { status: 200, data: { access_token: "NEW", refresh_token: "R2", expires_in: 3600 } }
        })
        const { deps, store, emit } = makeDeps({ post })
        store.map.set("https://a.com", { accessToken: "OLD", refreshToken: "RR", expiresAt: 0 })
        const pending = reauth("https://a.com", "/raven/x", "CLIENT", deps)
        await pump()
        emit(`${REDIRECT_URL}?state=STATE&code=CODE1`)
        await pending
        expect(store.remove).toHaveBeenCalledWith("https://a.com")
        expect(deps.openBrowser).toHaveBeenCalledTimes(1)
        expect(deps.login).toHaveBeenCalledWith("https://a.com", "NEW", "/raven/x")
        const removeOrder = (store.remove as any).mock.invocationCallOrder[0]
        const openOrder = (deps.openBrowser as any).mock.invocationCallOrder[0]
        expect(removeOrder).toBeLessThan(openOrder)
        // Splash from the refresh attempt must be gone before the browser opens.
        const hideOrder = (deps.progress.hide as any).mock.invocationCallOrder[0]
        expect(hideOrder).toBeLessThan(openOrder)
    })
    it("falls back to the site login page without tokens or a client id", async () => {
        const { deps } = makeDeps()
        await reauth("https://a.com", "/raven/x", undefined, deps)
        expect(deps.navigate).toHaveBeenCalledWith("https://a.com/login?redirect-to=%2Fraven%2Fx")
        expect(deps.openBrowser).not.toHaveBeenCalled()
        expect(deps.login).not.toHaveBeenCalled()
    })
})

describe("signOut", () => {
    it("revokes refresh then access token and clears the store even when post fails", async () => {
        const { deps, store } = makeDeps({ post: vi.fn(async () => { throw new Error("net") }) })
        store.map.set("https://a.com", { accessToken: "ACC", refreshToken: "REF", expiresAt: 0 })
        await expect(signOut("https://a.com", deps)).resolves.toBeUndefined()
        expect(store.remove).toHaveBeenCalledWith("https://a.com")
        expect(deps.post).toHaveBeenCalledTimes(2)
        expect((deps.post as any).mock.calls.map((c: any[]) => [c[1].token, c[1].token_type_hint]))
            .toEqual([["REF", "refresh_token"], ["ACC", "access_token"]])
    })
    it("does nothing without stored tokens", async () => {
        const { deps } = makeDeps()
        await signOut("https://a.com", deps)
        expect(deps.post).not.toHaveBeenCalled()
    })
})
