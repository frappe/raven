declare global {
    interface Window { Capacitor?: { isNativePlatform(): boolean; getPlatform(): string } }
}

// Reads the bridge global only — never imports @capacitor/core, so browser
// bundles stay free of Capacitor code.
export const isNative = (): boolean =>
    typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() === true

export const nativePlatform = (): "ios" | "android" | "web" => {
    const p = typeof window !== "undefined" ? window.Capacitor?.getPlatform?.() : undefined
    return p === "ios" || p === "android" ? p : "web"
}

export const shellOrigin = (): string =>
    nativePlatform() === "ios" ? "capacitor://localhost" : "https://localhost"
