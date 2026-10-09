import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeSession, endSession, onRequestError, setSessionLostHandler, setTokenRefreshedHandler, startSession, type ActiveSession, type SessionDeps } from "./session"
import type { Site } from "./sites"
import { rejectedExchange, type StoredTokens } from "./auth"

const site: Site = { url: "https://a.com", name: "A", sitename: "a.com", clientId: "C", ravenVersion: "3.0.0" }
const HOUR = 3600_000

const makeDeps = (tokens: StoredTokens | null, refreshed?: StoredTokens | Error) => {
    const store = new Map<string, StoredTokens>()
    if (tokens) store.set(site.url, tokens)
    const deps: SessionDeps = {
        getTokens: vi.fn(async (url) => store.get(url) ?? null),
        refresh: vi.fn(async () => {
            if (refreshed instanceof Error) throw refreshed
            if (!refreshed) throw new Error("no refresh configured")
            store.set(site.url, refreshed)
            return refreshed
        }),
        now: () => 1_000_000,
    }
    return deps
}

describe("startSession", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => { endSession(); vi.useRealTimers() })

    it("uses a fresh token as is and schedules a refresh at 80% of its lifetime", async () => {
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + HOUR }, { accessToken: "AT2", refreshToken: "RT", expiresAt: 1_000_000 + 2 * HOUR })
        const session = await startSession(site, deps) as ActiveSession
        expect(session.getToken()).toBe("AT")
        expect(deps.refresh).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(0.8 * HOUR + 1)
        expect(deps.refresh).toHaveBeenCalledTimes(1)
        expect(activeSession()?.getToken()).toBe("AT2")
    })
    it("refreshes first when the token is within five minutes of expiry", async () => {
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + 60_000 }, { accessToken: "AT2", refreshToken: "RT", expiresAt: 1_000_000 + HOUR })
        const session = await startSession(site, deps) as ActiveSession
        expect(deps.refresh).toHaveBeenCalledTimes(1)
        expect(session.getToken()).toBe("AT2")
    })
    it("reports every refreshed access token", async () => {
        const refreshed = vi.fn()
        setTokenRefreshedHandler(refreshed)
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + 60_000 }, { accessToken: "AT2", refreshToken: "RT", expiresAt: 1_000_000 + HOUR })
        await startSession(site, deps)
        expect(refreshed).toHaveBeenCalledWith("AT2")
    })
    it("returns null without tokens", async () => {
        expect(await startSession(site, makeDeps(null))).toBeNull()
        expect(activeSession()).toBeNull()
    })
    it("is rejected when the site refuses the startup refresh", async () => {
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 0 }, rejectedExchange("invalid_grant"))
        expect(await startSession(site, deps)).toBe("rejected")
        expect(activeSession()).toBeNull()
    })
    it("keeps the stale session when the startup refresh cannot reach the site, and retries later", async () => {
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 0 }, new Error("timeout"))
        const session = await startSession(site, deps)
        expect((session as ActiveSession).getToken()).toBe("AT")
        expect(deps.refresh).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(30_000)
        expect(deps.refresh).toHaveBeenCalledTimes(2)
        // Every failed try schedules the next one, not only the first.
        await vi.advanceTimersByTimeAsync(30_000)
        expect(deps.refresh).toHaveBeenCalledTimes(3)
    })
})

describe("onRequestError", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => { endSession(); vi.useRealTimers() })

    it("refreshes once on a 401 and keeps the session", async () => {
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + HOUR }, { accessToken: "AT2", refreshToken: "RT", expiresAt: 1_000_000 + HOUR })
        await startSession(site, deps)
        onRequestError({ httpStatus: 401 })
        onRequestError({ httpStatus: 401 })
        await vi.advanceTimersByTimeAsync(0)
        expect(deps.refresh).toHaveBeenCalledTimes(1)
        expect(activeSession()?.getToken()).toBe("AT2")
    })
    it("keeps the session when the refresh after a 401 cannot reach the site", async () => {
        const lost = vi.fn()
        setSessionLostHandler(lost)
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + HOUR }, new Error("timeout"))
        await startSession(site, deps)
        onRequestError({ httpStatus: 401 })
        await vi.advanceTimersByTimeAsync(0)
        expect(lost).not.toHaveBeenCalled()
        expect(activeSession()?.getToken()).toBe("AT")
    })
    it("ends the session and reports it when the site refuses the refresh after a 401", async () => {
        const lost = vi.fn()
        setSessionLostHandler(lost)
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + HOUR }, rejectedExchange("invalid_grant"))
        await startSession(site, deps)
        onRequestError({ httpStatus: 401 })
        await vi.advanceTimersByTimeAsync(0)
        expect(lost).toHaveBeenCalledTimes(1)
        expect(activeSession()).toBeNull()
    })
    it("ignores other errors", async () => {
        const deps = makeDeps({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + HOUR })
        await startSession(site, deps)
        onRequestError({ httpStatus: 500 })
        onRequestError({})
        await vi.advanceTimersByTimeAsync(0)
        expect(deps.refresh).not.toHaveBeenCalled()
    })
})
