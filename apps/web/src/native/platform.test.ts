import { afterEach, describe, expect, it } from "vitest"
import { isNative, nativePlatform } from "./platform"

const setCap = (platform: string | null) => {
    if (platform) (globalThis as any).window = { Capacitor: { isNativePlatform: () => platform !== "web", getPlatform: () => platform } }
    else (globalThis as any).window = {}
}
afterEach(() => { delete (globalThis as any).window })

describe("platform", () => {
    it("is web without a bridge", () => { setCap(null); expect(isNative()).toBe(false); expect(nativePlatform()).toBe("web") })
    it("reports ios", () => { setCap("ios"); expect(isNative()).toBe(true); expect(nativePlatform()).toBe("ios") })
    it("reports android", () => { setCap("android"); expect(nativePlatform()).toBe("android") })
})
