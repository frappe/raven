import { beforeEach, describe, expect, it, vi } from "vitest"

const prefs = new Map<string, string>()
const storage = new Map<string, string>()
vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => storage.clear(),
})
const listeners = new Map<string, (event: { token: string }) => void>()
const fm = {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getToken: vi.fn(async () => ({ token: "device-token" })),
    addListener: vi.fn(async (event: string, handler: (event: { token: string }) => void) => {
        listeners.set(event, handler)
        return { remove: async () => { } }
    }),
}

vi.mock("@lib/site", () => ({ siteFetch: vi.fn(async () => ({ ok: true })), siteKey: (k: string) => k, siteOrigin: () => "https://a.com" }))
vi.mock("@capacitor/preferences", () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value) },
        remove: async ({ key }: { key: string }) => { prefs.delete(key) },
    },
}))
vi.mock("@capacitor-firebase/messaging", () => ({ FirebaseMessaging: fm }))

const { initNativePush, disableNativePush } = await import("./push")
const { siteFetch } = await import("@lib/site")
const subscribedTokens = () =>
    vi.mocked(siteFetch).mock.calls
        .filter(([path]) => String(path).endsWith("subscribe") && !String(path).endsWith("unsubscribe"))
        .map(([, init]) => JSON.parse(String(init?.body)).fcm_token)

// Long enough for the startup chain's dynamic imports; positive checks wait on their condition.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
const start = async (choice: string | null, permission: string) => {
    if (choice === null) prefs.delete("pushWanted.https://a.com")
    else prefs.set("pushWanted.https://a.com", choice)
    fm.checkPermissions.mockResolvedValue({ receive: permission })
    fm.requestPermissions.mockResolvedValue({ receive: permission === "prompt" ? "granted" : permission })
    initNativePush()
    await settle()
}

describe("initNativePush on a site without push", () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it("asks once on a first run, and allowing turns push on", async () => {
        await start(null, "prompt")
        await vi.waitFor(() => expect(prefs.get("pushWanted.https://a.com")).toBe("1"))
        expect(fm.requestPermissions).toHaveBeenCalledTimes(1)
        expect(localStorage.getItem("raven-native-fcm-token")).toBe("device-token")
    })

    it("turns push on without asking where the device already allows it", async () => {
        await start(null, "granted")
        await vi.waitFor(() => expect(localStorage.getItem("raven-native-fcm-token")).toBe("device-token"))
    })

    it("leaves a site turned off in the app off", async () => {
        await start("0", "granted")
        expect(fm.requestPermissions).not.toHaveBeenCalled()
        expect(localStorage.getItem("raven-native-fcm-token")).toBeNull()
    })

    it("does not ask again for a site signed out of with push on", async () => {
        await start("1", "prompt")
        expect(fm.requestPermissions).not.toHaveBeenCalled()
    })

    it("does nothing once the system has been declined", async () => {
        await start(null, "denied")
        await start(null, "prompt-with-rationale")
        expect(fm.requestPermissions).not.toHaveBeenCalled()
    })

    it("sends a token replaced after a first enable to the server", async () => {
        await start(null, "granted")
        await vi.waitFor(() => expect(localStorage.getItem("raven-native-fcm-token")).toBe("device-token"))
        listeners.get("tokenReceived")?.({ token: "rotated-token" })
        await vi.waitFor(() => expect(localStorage.getItem("raven-native-fcm-token")).toBe("rotated-token"))
        expect(subscribedTokens()).toContain("rotated-token")
    })

    it("ignores a rotation once push is turned off", async () => {
        await start(null, "granted")
        await vi.waitFor(() => expect(localStorage.getItem("raven-native-fcm-token")).toBe("device-token"))
        await disableNativePush()
        vi.mocked(siteFetch).mockClear()
        listeners.get("tokenReceived")?.({ token: "rotated-token" })
        await settle()
        expect(localStorage.getItem("raven-native-fcm-token")).toBeNull()
        expect(subscribedTokens()).toEqual([])
    })
})

describe("initNativePush on a site with push on", () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it("subscribes an unchanged token again, so a row the server dropped comes back", async () => {
        localStorage.setItem("raven-native-fcm-token", "device-token")
        await start("1", "granted")
        await vi.waitFor(() => expect(subscribedTokens()).toEqual(["device-token"]))
        expect(localStorage.getItem("raven-native-fcm-token")).toBe("device-token")
    })
})

describe("disableNativePush", () => {
    it("records the site as turned off, unless it is only a sign-out", async () => {
        prefs.delete("pushWanted.https://a.com")
        await disableNativePush(true)
        expect(prefs.get("pushWanted.https://a.com")).toBeUndefined()
        await disableNativePush()
        expect(prefs.get("pushWanted.https://a.com")).toBe("0")
    })
})
