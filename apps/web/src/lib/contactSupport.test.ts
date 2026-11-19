import { afterEach, describe, expect, it, vi } from "vitest"

// isNative reads the bridge global; node has no window.
afterEach(() => vi.unstubAllGlobals())

const nativeWindow = (boot: Record<string, unknown>, platform = "ios", plugins: string[] = []) =>
    vi.stubGlobal("window", {
        Capacitor: {
            isNativePlatform: () => true,
            getPlatform: () => platform,
            isPluginAvailable: (name: string) => plugins.includes(name),
        },
        frappe: { boot },
    })

const freshModule = async () => {
    vi.resetModules()
    return import("./contactSupport")
}

describe("canShareContact", () => {
    it("is true in the native app with the RavenContacts plugin", async () => {
        nativeWindow({}, "ios", ["RavenContacts"])
        const { canShareContact } = await freshModule()
        expect(canShareContact()).toBe(true)
    })

    it("is false in a native binary without the RavenContacts plugin", async () => {
        nativeWindow({})
        const { canShareContact } = await freshModule()
        expect(canShareContact()).toBe(false)
    })

    it("needs the contact picker APIs on the web", async () => {
        vi.stubGlobal("window", { ContactsManager: {} })
        vi.stubGlobal("navigator", { contacts: {} })
        const supported = await freshModule()
        expect(supported.canShareContact()).toBe(true)

        vi.stubGlobal("window", {})
        vi.stubGlobal("navigator", {})
        const noApi = await freshModule()
        expect(noApi.canShareContact()).toBe(false)
    })
})
