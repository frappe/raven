import { afterEach, describe, expect, it } from "vitest"
import { hasNativePlugin, isNative, nativePlatform, siteHasFeature } from "./platform"

const setCap = (platform: string | null, plugins: string[] = [], boot: Record<string, unknown> = {}) => {
    if (platform) (globalThis as any).window = { Capacitor: { isNativePlatform: () => platform !== "web", getPlatform: () => platform, isPluginAvailable: (name: string) => plugins.includes(name) }, frappe: { boot } }
    else (globalThis as any).window = {}
}
afterEach(() => { delete (globalThis as any).window })

describe("platform", () => {
    it("is web without a bridge", () => { setCap(null); expect(isNative()).toBe(false); expect(nativePlatform()).toBe("web") })
    it("reports ios", () => { setCap("ios"); expect(isNative()).toBe(true); expect(nativePlatform()).toBe("ios") })
    it("reports android", () => { setCap("android"); expect(nativePlatform()).toBe("android") })
    it("finds an installed plugin", () => { setCap("ios", ["Geolocation"]); expect(hasNativePlugin("Geolocation")).toBe(true) })
    it("misses a plugin the binary lacks", () => { setCap("ios"); expect(hasNativePlugin("Geolocation")).toBe(false) })
    it("reports no plugin on the web", () => { setCap(null); expect(hasNativePlugin("Geolocation")).toBe(false) })
    it("has every feature on the web", () => { setCap(null); expect(siteHasFeature("contact_messages")).toBe(true) })
    it("needs the boot flag in the app", () => {
        setCap("ios"); expect(siteHasFeature("contact_messages")).toBe(false)
        setCap("ios", [], { raven_features: ["location_messages"] }); expect(siteHasFeature("contact_messages")).toBe(false)
        setCap("ios", [], { raven_features: ["contact_messages"] }); expect(siteHasFeature("contact_messages")).toBe(true)
    })
    it("ignores a non-array flag", () => { setCap("ios", [], { raven_features: "contact_messages" }); expect(siteHasFeature("contact_messages")).toBe(false) })
})
