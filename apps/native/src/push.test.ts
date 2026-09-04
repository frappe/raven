import { describe, expect, it, vi } from "vitest"
import { unsubscribeSitePush, type PushDeps } from "./push"

const makeDeps = (over: Partial<PushDeps> = {}): PushDeps => ({
    pushToken: vi.fn(async () => "FCM"),
    clearPushToken: vi.fn(async () => { }),
    accessToken: vi.fn(async () => "ACC"),
    post: vi.fn(async () => ({ status: 200 })),
    ...over,
})

describe("unsubscribeSitePush", () => {
    it("posts the site's push token to unsubscribe with the OAuth bearer, then forgets it", async () => {
        const deps = makeDeps()
        await unsubscribeSitePush("https://a.com", deps)
        expect(deps.post).toHaveBeenCalledWith(
            "https://a.com/api/method/raven.api.notification.unsubscribe",
            { fcm_token: "FCM" },
            "ACC",
        )
        expect(deps.clearPushToken).toHaveBeenCalledWith("https://a.com")
    })
    it("does nothing without a push token", async () => {
        const deps = makeDeps({ pushToken: vi.fn(async () => null) })
        await unsubscribeSitePush("https://a.com", deps)
        expect(deps.post).not.toHaveBeenCalled()
        expect(deps.clearPushToken).not.toHaveBeenCalled()
    })
    it("keeps the token when there is no access token to authenticate with", async () => {
        const deps = makeDeps({ accessToken: vi.fn(async () => null) })
        await unsubscribeSitePush("https://a.com", deps)
        expect(deps.post).not.toHaveBeenCalled()
        expect(deps.clearPushToken).not.toHaveBeenCalled()
    })
    it("forgets the token even when the server call fails", async () => {
        const deps = makeDeps({ post: vi.fn(async () => { throw new Error("net") }) })
        await expect(unsubscribeSitePush("https://a.com", deps)).resolves.toBeUndefined()
        expect(deps.clearPushToken).toHaveBeenCalledWith("https://a.com")
    })
})
