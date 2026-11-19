import {
    appleMapsAppUrl,
    googleMapsAppUrl,
    googleMapsUrl,
    appleMapsUrl,
    geoUri,
    wazeAppUrl,
    wazeWebUrl,
    type LocationMeta,
} from "@lib/location"
import _ from "@lib/translate"
import { hasNativePlugin, isNative } from "./platform"

export type MapsOption = {
    id: "apple" | "google" | "waze"
    label: string
    url: string
    fallbackUrl: string
}

export type InstalledIosMapsApps = { google: boolean; waze: boolean }

export type OpenPlan = "geo" | "ios" | "sheet" | "menu"

/** How a location opens on each platform; mobile only changes the web flow. */
export const openPlan = (platform: "ios" | "android" | "web", isMobile: boolean): OpenPlan =>
    platform === "android" ? "geo" : platform === "ios" ? "ios" : isMobile ? "sheet" : "menu"

type MapsAppId = MapsOption["id"]

type MapsApp = {
    label: () => string
    appUrl: (meta: LocationMeta) => string
    webUrl: (meta: LocationMeta) => string
}

const MAPS_APPS = {
    apple: { label: () => _("Apple Maps"), appUrl: appleMapsAppUrl, webUrl: appleMapsUrl },
    google: { label: () => _("Google Maps"), appUrl: googleMapsAppUrl, webUrl: googleMapsUrl },
    waze: { label: () => _("Waze"), appUrl: wazeAppUrl, webUrl: wazeWebUrl },
} satisfies Record<MapsAppId, MapsApp>

const appOption = (id: MapsAppId, meta: LocationMeta): MapsOption => ({
    id,
    label: MAPS_APPS[id].label(),
    url: MAPS_APPS[id].appUrl(meta),
    fallbackUrl: MAPS_APPS[id].webUrl(meta),
})

/** Android's single choice: the `geo:` intent, with Google Maps on the web as its fallback. */
export const androidMapsOption = (meta: LocationMeta): MapsOption => ({
    ...appOption("google", meta),
    url: geoUri(meta),
})

const webOption = (id: "apple" | "google", meta: LocationMeta): MapsOption => {
    const url = MAPS_APPS[id].webUrl(meta)
    return { id, label: MAPS_APPS[id].label(), url, fallbackUrl: url }
}

/** iOS apps to offer: Apple Maps always, then the known apps the device has. */
export const iosMapsOptions = (meta: LocationMeta, installed: InstalledIosMapsApps): MapsOption[] => [
    appOption("apple", meta),
    ...(installed.google ? [appOption("google", meta)] : []),
    ...(installed.waze ? [appOption("waze", meta)] : []),
]

/** Web / PWA apps, in menu order. */
export const webMapsOptions = (meta: LocationMeta): MapsOption[] => [
    webOption("google", meta),
    webOption("apple", meta),
]

const detectInstalledMapsApps = async (): Promise<InstalledIosMapsApps> => {
    if (!hasNativePlugin("AppLauncher")) return { google: false, waze: false }
    try {
        const { AppLauncher } = await import("@capacitor/app-launcher")
        const isInstalled = async (url: string): Promise<boolean> => {
            try {
                return (await AppLauncher.canOpenUrl({ url })).value
            } catch {
                return false
            }
        }
        const [google, waze] = await Promise.all([isInstalled("comgooglemaps://"), isInstalled("waze://")])
        return { google, waze }
    } catch {
        return { google: false, waze: false }
    }
}

let launching = false

/** Which known iOS maps apps can open; detected on each tap. */
export const installedIosMapsApps = (): Promise<InstalledIosMapsApps> => detectInstalledMapsApps()

/** Open a URL through the plugin; false when no app handled it. */
const openUrlHandled = async (url: string): Promise<boolean> => {
    try {
        const { AppLauncher } = await import("@capacitor/app-launcher")
        return (await AppLauncher.openUrl({ url })).completed
    } catch {
        return false
    }
}

/** Hand a maps URL to the OS, falling back to its https link; on the web it opens a new tab. */
export const openExternal = async (url: string, fallbackUrl?: string): Promise<void> => {
    if (!isNative()) {
        window.open(url, "_blank", "noopener")
        return
    }
    if (launching) return
    launching = true
    setTimeout(() => {
        launching = false
    }, 1000)
    if (!hasNativePlugin("AppLauncher")) {
        window.open(fallbackUrl ?? url, "_blank", "noopener")
        return
    }
    const opened = await openUrlHandled(url)
    if (!opened && fallbackUrl) await openUrlHandled(fallbackUrl)
}
