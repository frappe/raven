import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { appleMapsUrl, geoUri, googleMapsUrl, wazeWebUrl } from "@lib/location"
import { androidMapsOption, iosMapsOptions, openPlan, webMapsOptions } from "./openMaps"

const meta = { latitude: 1, longitude: 2 }

beforeEach(() => {
    vi.stubGlobal("window", {})
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.doUnmock("@capacitor/app-launcher")
    vi.resetModules()
})

const nativeModule = async (openUrl: ReturnType<typeof vi.fn>, appLauncher = true) => {
    vi.stubGlobal("window", {
        Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => appLauncher },
    })
    vi.doMock("@capacitor/app-launcher", () => ({ AppLauncher: { openUrl } }))
    vi.resetModules()
    const { openExternal } = await import("./openMaps")
    return openExternal
}

const nativeWindow = (plugins: string[] = ["AppLauncher"]) =>
    vi.stubGlobal("window", {
        Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name: string) => plugins.includes(name) },
    })

describe("iosMapsOptions", () => {
    it("lists Apple first and only installed apps", () => {
        expect(iosMapsOptions(meta, { google: false, waze: false }).map((o) => o.id)).toEqual(["apple"])
        expect(iosMapsOptions(meta, { google: true, waze: true }).map((o) => o.id)).toEqual(["apple", "google", "waze"])
        expect(iosMapsOptions(meta, { google: true, waze: false })[1].url).toBe("comgooglemaps://?q=1,2&center=1,2")
    })

    it("carries the https fallback for every app", () => {
        const fallbacks = iosMapsOptions(meta, { google: true, waze: true }).map((o) => o.fallbackUrl)
        expect(fallbacks).toEqual([appleMapsUrl(meta), googleMapsUrl(meta), wazeWebUrl(meta)])
    })
})

describe("webMapsOptions", () => {
    it("web offers Google then Apple", () => {
        const options = webMapsOptions(meta)
        expect(options.map((o) => o.url)).toEqual([googleMapsUrl(meta), appleMapsUrl(meta)])
        expect(options.map((o) => o.fallbackUrl)).toEqual(options.map((o) => o.url))
    })
})

describe("androidMapsOption", () => {
    it("opens the geo intent and falls back to Google Maps", () => {
        expect(androidMapsOption(meta)).toEqual({
            id: "google",
            label: "Google Maps",
            url: geoUri(meta),
            fallbackUrl: googleMapsUrl(meta),
        })
    })
})

describe("openPlan", () => {
    it.each([
        ["android", true, "geo"],
        ["android", false, "geo"],
        ["ios", true, "ios"],
        ["ios", false, "ios"],
        ["web", true, "sheet"],
        ["web", false, "menu"],
    ] as const)("%s + mobile=%s -> %s", (platform, isMobile, expected) => {
        expect(openPlan(platform, isMobile)).toBe(expected)
    })
})

describe("openExternal", () => {
    const appUrl = "comgooglemaps://?q=1,2&center=1,2"
    const fallbackUrl = googleMapsUrl(meta)

    it("opens the app URL when it completes", async () => {
        const openUrl = vi.fn(async () => ({ completed: true }))
        const openExternal = await nativeModule(openUrl)

        await openExternal(appUrl, fallbackUrl)

        expect(openUrl).toHaveBeenCalledTimes(1)
        expect(openUrl).toHaveBeenCalledWith({ url: appUrl })
    })

    it("opens the fallback when the app does not complete", async () => {
        const openUrl = vi.fn(async () => ({ completed: false }))
        const openExternal = await nativeModule(openUrl)

        await openExternal(appUrl, fallbackUrl)

        expect(openUrl.mock.calls).toEqual([[{ url: appUrl }], [{ url: fallbackUrl }]])
    })

    it("opens the fallback when the app URL throws", async () => {
        const openUrl = vi.fn().mockRejectedValueOnce(new Error("no app")).mockResolvedValueOnce({ completed: true })
        const openExternal = await nativeModule(openUrl)

        await openExternal(appUrl, fallbackUrl)

        expect(openUrl.mock.calls).toEqual([[{ url: appUrl }], [{ url: fallbackUrl }]])
    })

    it("ignores a second launch within a second", async () => {
        vi.useFakeTimers()
        const resolvers: Array<(value: { completed: boolean }) => void> = []
        const openUrl = vi.fn(() => new Promise<{ completed: boolean }>((resolve) => resolvers.push(resolve)))
        const openExternal = await nativeModule(openUrl)

        const first = openExternal(appUrl)
        await vi.advanceTimersByTimeAsync(0)
        expect(openUrl).toHaveBeenCalledTimes(1)

        void openExternal(appUrl)
        await vi.advanceTimersByTimeAsync(0)
        expect(openUrl).toHaveBeenCalledTimes(1)

        resolvers.forEach((resolve) => resolve({ completed: true }))
        await first
        await vi.advanceTimersByTimeAsync(1000)

        void openExternal(appUrl)
        await vi.advanceTimersByTimeAsync(0)
        expect(openUrl).toHaveBeenCalledTimes(2)
    })

    it("stays put when there is no fallback", async () => {
        const openUrl = vi.fn(async () => ({ completed: false }))
        const openExternal = await nativeModule(openUrl)

        await expect(openExternal(appUrl)).resolves.toBeUndefined()
        expect(openUrl).toHaveBeenCalledTimes(1)
    })

    it("opens the https fallback in the system browser without AppLauncher", async () => {
        const open = vi.fn()
        const openUrl = vi.fn()
        const importPlugin = vi.fn()
        vi.stubGlobal("window", {
            Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => false },
            open,
        })
        vi.doMock("@capacitor/app-launcher", () => {
            importPlugin()
            return { AppLauncher: { openUrl } }
        })
        vi.resetModules()
        const { openExternal } = await import("./openMaps")

        await openExternal(appUrl, fallbackUrl)

        expect(open).toHaveBeenCalledWith(fallbackUrl, "_blank", "noopener")
        expect(importPlugin).not.toHaveBeenCalled()
        expect(openUrl).not.toHaveBeenCalled()
    })

    it("opens a new tab on the web and never loads the plugin", async () => {
        const open = vi.fn()
        const openUrl = vi.fn()
        vi.stubGlobal("window", { open })
        vi.doMock("@capacitor/app-launcher", () => ({ AppLauncher: { openUrl } }))
        vi.resetModules()
        const { openExternal } = await import("./openMaps")

        await openExternal(appUrl, fallbackUrl)

        expect(open).toHaveBeenCalledWith(appUrl, "_blank", "noopener")
        expect(openUrl).not.toHaveBeenCalled()
    })
})

describe("installedIosMapsApps", () => {
    it("reports no apps when the binary lacks AppLauncher", async () => {
        const importPlugin = vi.fn()
        nativeWindow([])
        vi.doMock("@capacitor/app-launcher", () => {
            importPlugin()
            return { AppLauncher: { canOpenUrl: vi.fn() } }
        })
        vi.resetModules()
        const { installedIosMapsApps } = await import("./openMaps")

        await expect(installedIosMapsApps()).resolves.toEqual({ google: false, waze: false })
        expect(importPlugin).not.toHaveBeenCalled()
    })

    it("reports the apps the device can open", async () => {
        const canOpenUrl = vi.fn(async ({ url }: { url: string }) => ({ value: url === "comgooglemaps://" }))
        nativeWindow()
        vi.doMock("@capacitor/app-launcher", () => ({ AppLauncher: { canOpenUrl } }))
        vi.resetModules()
        const { installedIosMapsApps } = await import("./openMaps")

        await expect(installedIosMapsApps()).resolves.toEqual({ google: true, waze: false })
        expect(canOpenUrl).toHaveBeenCalledTimes(2)
    })

    it("treats detection errors as not installed", async () => {
        nativeWindow()
        vi.doMock("@capacitor/app-launcher", () => ({
            AppLauncher: { canOpenUrl: vi.fn(async () => { throw new Error("not available") }) },
        }))
        vi.resetModules()
        const { installedIosMapsApps } = await import("./openMaps")

        await expect(installedIosMapsApps()).resolves.toEqual({ google: false, waze: false })
    })
})
