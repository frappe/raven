// src/native/platform.test.ts
import { afterEach, describe, expect, it } from "vitest"
import { isNative, nativePlatform, shellOrigin } from "./platform"

const setCap = (platform: string | null) => {
    if (platform) (globalThis as any).window = { Capacitor: { isNativePlatform: () => platform !== "web", getPlatform: () => platform } }
    else (globalThis as any).window = {}
}
afterEach(() => { delete (globalThis as any).window })

describe("platform", () => {
    it("is web without a bridge", () => { setCap(null); expect(isNative()).toBe(false); expect(nativePlatform()).toBe("web") })
    it("reports ios", () => { setCap("ios"); expect(isNative()).toBe(true); expect(shellOrigin()).toBe("capacitor://localhost") })
    it("reports android", () => { setCap("android"); expect(shellOrigin()).toBe("https://localhost") })
})
