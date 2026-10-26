import { afterEach, describe, expect, it, vi } from "vitest"

// isNative reads the bridge global; node has no window.
afterEach(() => vi.unstubAllGlobals())

const nativeWindow = (boot: Record<string, unknown>, platform = "ios") =>
    vi.stubGlobal("window", {
        Capacitor: { isNativePlatform: () => true, getPlatform: () => platform },
        frappe: { boot },
    })

const freshModule = async () => {
    vi.resetModules()
    return import("./locationSupport")
}

describe("siteSupportsLocationMessages", () => {
    it("web always supports location messages", async () => {
        vi.stubGlobal("window", {})
        const { siteSupportsLocationMessages } = await import("./locationSupport")
        expect(siteSupportsLocationMessages()).toBe(true)
    })

    it("native needs the boot flag", async () => {
        nativeWindow({})
        const { siteSupportsLocationMessages } = await import("./locationSupport")
        expect(siteSupportsLocationMessages()).toBe(false)

        nativeWindow({ raven_features: ["location_messages"] })
        expect(siteSupportsLocationMessages()).toBe(true)
    })

    it("native ignores a non-array flag", async () => {
        nativeWindow({ raven_features: "location_messages" })
        const { siteSupportsLocationMessages } = await import("./locationSupport")
        expect(siteSupportsLocationMessages()).toBe(false)
    })
})

describe("canShareLocation", () => {
    it("is true in the native app", async () => {
        nativeWindow({})
        const { canShareLocation } = await freshModule()
        expect(canShareLocation()).toBe(true)
    })

    it("needs a secure context and the geolocation API on the web", async () => {
        vi.stubGlobal("window", { isSecureContext: true })
        vi.stubGlobal("navigator", { geolocation: {} })
        const supported = await freshModule()
        expect(supported.canShareLocation()).toBe(true)

        vi.stubGlobal("window", { isSecureContext: false })
        const insecure = await freshModule()
        expect(insecure.canShareLocation()).toBe(false)

        vi.stubGlobal("window", { isSecureContext: true })
        vi.stubGlobal("navigator", {})
        const noApi = await freshModule()
        expect(noApi.canShareLocation()).toBe(false)
    })
})
