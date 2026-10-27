import { hasNativePlugin, isNative } from "../native/platform"

let canShare: boolean | undefined

/** The device exposes a location API. A browser stays hidden until asked, so a denial is not cached. */
export const canShareLocation = (): boolean => {
    canShare ??= isNative()
        ? hasNativePlugin("Geolocation")
        : !!window.isSecureContext && "geolocation" in navigator
    return canShare
}

/** Web always serves the location client; the installed app needs the site to advertise the feature. */
export const siteSupportsLocationMessages = (): boolean => {
    if (!isNative()) return true
    const features = window.frappe?.boot?.raven_features
    return Array.isArray(features) && features.includes("location_messages")
}
