import { describe, expect, it, vi } from "vitest"
import { REDIRECT_URL, buildAuthorizeUrl, isRejectedExchange, parseCallback, refreshTokens, signIn, signOut, tokenStore, type AuthDeps, type StoredTokens } from "./auth"

const { secure } = vi.hoisted(() => ({ secure: new Map<string, string>() }))
vi.mock("capacitor-secure-storage-plugin", () => ({
    SecureStoragePlugin: {
        get: async ({ key }: { key: string }) => { if (!secure.has(key)) throw new Error("Item not found"); return { value: secure.get(key)! } },
        set: async ({ key, value }: { key: string; value: string }) => { secure.set(key, value); return { value: true } },
        remove: async ({ key }: { key: string }) => ({ value: secure.delete(key) }),
        // Like the native proxy: any unknown property is a plugin method, `then` included.
        then: () => { throw new Error("SecureStoragePlugin.then() is not implemented") },
    },
}))

describe("tokenStore", () => {
    it("round-trips tokens per site in secure storage and reads null when missing", async () => {
        expect(await tokenStore.get("https://a.com")).toBeNull()
        const tokens = { accessToken: "AT", refreshToken: "RT", expiresAt: 5 }
        await tokenStore.set("https://a.com", tokens)
        expect(secure.get("raven.tokens.https://a.com")).toBe(JSON.stringify(tokens))
        expect(await tokenStore.get("https://a.com")).toEqual(tokens)
        await tokenStore.remove("https://a.com")
        expect(await tokenStore.get("https://a.com")).toBeNull()
    })
    it("rejects a malformed stored value", async () => {
        secure.set("raven.tokens.https://b.com", JSON.stringify({ accessToken: "AT" }))
        expect(await tokenStore.get("https://b.com")).toBeNull()
    })
})

describe("buildAuthorizeUrl", () => {
    it("targets the authorize endpoint with the exact PKCE query", () => {
        expect(buildAuthorizeUrl("https://a.com", "CLIENT", "STATE", "CHALLENGE")).toBe(
            "https://a.com/api/method/frappe.integrations.oauth2.authorize"
            + "?client_id=CLIENT&response_type=code&scope=all+openid"
            + "&redirect_uri=raven.thecommit.company%3A%2F%2Foauth"
            + "&state=STATE&code_challenge=CHALLENGE&code_challenge_method=S256")
    })
})

describe("parseCallback", () => {
    it("reads code and state from a matching redirect", () => {
        expect(parseCallback(`${REDIRECT_URL}?code=ABC&state=S1`)).toEqual({ code: "ABC", state: "S1" })
    })
    it("accepts a trailing slash, a fragment, and a query-less redirect", () => {
        expect(parseCallback(`${REDIRECT_URL}/?code=x&state=y#f`)).toEqual({ code: "x", state: "y" })
        expect(parseCallback(REDIRECT_URL)).toEqual({})
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

const makeDeps = (overrides: Partial<AuthDeps> = {}) => {
    const stored = new Map<string, StoredTokens>()
    const deps: AuthDeps = {
        authorize: vi.fn(async () => `${REDIRECT_URL}?code=CODE&state=STATE`),
        post: vi.fn(async () => ({ status: 200, data: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } })),
        store: {
            get: async (site) => stored.get(site) ?? null,
            set: async (site, tokens) => { stored.set(site, tokens) },
            remove: async (site) => { stored.delete(site) },
        },
        pkce: { verifier: () => "VERIFIER", challenge: async () => "CHALLENGE", state: () => "STATE" },
        now: () => 1_000_000,
        ...overrides,
    }
    return { deps, stored }
}

describe("signIn", () => {
    it("opens the site's page, exchanges the code with the verifier, stores tokens with expiry", async () => {
        const { deps, stored } = makeDeps()
        const tokens = await signIn("https://a.com", "C", deps)
        expect(deps.authorize).toHaveBeenCalledWith(expect.stringContaining("https://a.com/api/method/frappe.integrations.oauth2.authorize?"))
        expect(deps.post).toHaveBeenCalledWith("https://a.com/api/method/frappe.integrations.oauth2.get_token", {
            grant_type: "authorization_code", code: "CODE", client_id: "C", redirect_uri: REDIRECT_URL, code_verifier: "VERIFIER",
        })
        expect(tokens).toEqual({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + 3600 * 1000 })
        expect(stored.get("https://a.com")).toEqual(tokens)
    })
    it("rejects a callback that answers another request", async () => {
        const { deps } = makeDeps({ authorize: vi.fn(async () => `${REDIRECT_URL}?code=CODE&state=OTHER`) })
        await expect(signIn("https://a.com", "C", deps)).rejects.toThrow("different request")
        expect(deps.post).not.toHaveBeenCalled()
    })
    it("rejects when the user denies", async () => {
        const { deps } = makeDeps({ authorize: vi.fn(async () => `${REDIRECT_URL}?error=access_denied`) })
        await expect(signIn("https://a.com", "C", deps)).rejects.toThrow("access_denied")
    })
    it("rejects as cancelled when the page closes without a redirect", async () => {
        const { deps } = makeDeps({ authorize: vi.fn(async () => null) })
        await expect(signIn("https://a.com", "C", deps)).rejects.toThrow("cancelled")
    })
    it("rejects when the token exchange fails and stores nothing", async () => {
        const { deps, stored } = makeDeps({ post: vi.fn(async () => ({ status: 401, data: { error: "invalid_grant" } })) })
        await expect(signIn("https://a.com", "C", deps)).rejects.toThrow("invalid_grant")
        expect(stored.size).toBe(0)
    })
})

describe("refreshTokens", () => {
    it("marks a refusal as rejected, and a server failure as not", async () => {
        const refused = makeDeps({ post: vi.fn(async () => ({ status: 400, data: { error: "invalid_grant" } })) })
        refused.stored.set("https://a.com", { accessToken: "AT", refreshToken: "RT", expiresAt: 0 })
        await expect(refreshTokens("https://a.com", "C", refused.deps)).rejects.toSatisfy((e) => isRejectedExchange(e))
        const down = makeDeps({ post: vi.fn(async () => ({ status: 503, data: null })) })
        down.stored.set("https://a.com", { accessToken: "AT", refreshToken: "RT", expiresAt: 0 })
        await expect(refreshTokens("https://a.com", "C", down.deps)).rejects.toSatisfy((e) => !isRejectedExchange(e))
    })
    it("is rejected without a refresh token: no retry can succeed, only a new sign-in", async () => {
        const { deps, stored } = makeDeps()
        stored.set("https://a.com", { accessToken: "AT", expiresAt: 0 })
        await expect(refreshTokens("https://a.com", "C", deps)).rejects.toSatisfy((e) => isRejectedExchange(e))
        expect(deps.post).not.toHaveBeenCalled()
    })
    it("posts the refresh token and stores the new pair, keeping the old refresh token when none is returned", async () => {
        const { deps, stored } = makeDeps({ post: vi.fn(async () => ({ status: 200, data: { access_token: "AT2", expires_in: 60 } })) })
        stored.set("https://a.com", { accessToken: "AT", refreshToken: "RT", expiresAt: 0 })
        const tokens = await refreshTokens("https://a.com", "C", deps)
        expect(deps.post).toHaveBeenCalledWith("https://a.com/api/method/frappe.integrations.oauth2.get_token", {
            grant_type: "refresh_token", refresh_token: "RT", client_id: "C",
        })
        expect(tokens).toEqual({ accessToken: "AT2", refreshToken: "RT", expiresAt: 1_000_000 + 60_000 })
        expect(stored.get("https://a.com")).toEqual(tokens)
    })
    it("throws and keeps the stored tokens when the refresh fails", async () => {
        const { deps, stored } = makeDeps({ post: vi.fn(async () => ({ status: 400, data: { error: "invalid_grant" } })) })
        const old = { accessToken: "AT", refreshToken: "RT", expiresAt: 0 }
        stored.set("https://a.com", old)
        await expect(refreshTokens("https://a.com", "C", deps)).rejects.toThrow("invalid_grant")
        expect(stored.get("https://a.com")).toEqual(old)
    })
    it("throws without a refresh token", async () => {
        const { deps, stored } = makeDeps()
        stored.set("https://a.com", { accessToken: "AT", expiresAt: 0 })
        await expect(refreshTokens("https://a.com", "C", deps)).rejects.toThrow()
        expect(deps.post).not.toHaveBeenCalled()
    })
})

describe("signOut", () => {
    it("removes the tokens and revokes both, refresh first", async () => {
        const { deps, stored } = makeDeps()
        stored.set("https://a.com", { accessToken: "AT", refreshToken: "RT", expiresAt: 0 })
        await signOut("https://a.com", deps)
        expect(stored.size).toBe(0)
        const calls = (deps.post as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1])
        expect(calls).toEqual([
            { token: "RT", token_type_hint: "refresh_token" },
            { token: "AT", token_type_hint: "access_token" },
        ])
    })
    it("is a no-op without tokens", async () => {
        const { deps } = makeDeps()
        await signOut("https://a.com", deps)
        expect(deps.post).not.toHaveBeenCalled()
    })
    it("swallows revoke failures", async () => {
        const { deps, stored } = makeDeps({ post: vi.fn(async () => { throw new Error("offline") }) })
        stored.set("https://a.com", { accessToken: "AT", expiresAt: 0 })
        await expect(signOut("https://a.com", deps)).resolves.toBeUndefined()
        expect(stored.size).toBe(0)
    })
})
