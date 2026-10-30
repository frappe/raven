import { hasNativePlugin, isNative } from "../native/platform"

let canShare: boolean | undefined

/** The device exposes a location API. A browser stays hidden until asked, so a denial is not cached. */
export const canShareLocation = (): boolean => {
    canShare ??= isNative()
        ? hasNativePlugin("Geolocation")
        : !!window.isSecureContext && "geolocation" in navigator
    return canShare
}
