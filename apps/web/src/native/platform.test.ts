import { afterEach, describe, expect, it } from "vitest"
import { hasNativePlugin, isNative, nativePlatform } from "./platform"

const setCap = (platform: string | null, plugins: string[] = []) => {
    if (platform) (globalThis as any).window = { Capacitor: { isNativePlatform: () => platform !== "web", getPlatform: () => platform, isPluginAvailable: (name: string) => plugins.includes(name) } }
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
})
