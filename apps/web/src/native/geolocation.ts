import { isNative } from "./platform"

export type PositionFix = { latitude: number; longitude: number; accuracy: number }
export type FixError = "denied" | "unavailable" | "timeout"
export type PositionResult = { fix: PositionFix } | { error: FixError }

const HIGH_ACCURACY = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
const LOW_ACCURACY = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
// The API's own timeout excludes the permission prompt; Firefox's "Not now" never calls back.
const FIX_WATCHDOG_MS = 30000

const fixOf = (coords: { latitude: number; longitude: number; accuracy: number }): PositionFix => ({
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
})

const webError = (error: GeolocationPositionError): FixError => {
    if (error.code === 1) return "denied"
    if (error.code === 3) return "timeout"
    return "unavailable"
}

const webPosition = (options: PositionOptions): Promise<PositionResult> =>
    new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ error: "unavailable" })
            return
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ fix: fixOf(position.coords) }),
            (error) => resolve({ error: webError(error) }),
            options,
        )
    })

// @capacitor/geolocation's OS-PLUG-GLOC error table.
const GLOC_DENIED = 3
const GLOC_RESTRICTED = 8
const GLOC_TIMEOUT = 10

const nativeErrorCode = (error: unknown): number | null => {
    const record = (error ?? {}) as { code?: unknown; message?: unknown }
    const text =
        typeof record.code === "string" ? record.code : typeof record.message === "string" ? record.message : String(error)
    const match = /OS-PLUG-GLOC-(\d{4})/.exec(text)
    return match ? Number(match[1]) : null
}

const nativeError = (error: unknown): FixError => {
    const code = nativeErrorCode(error)
    if (code === GLOC_TIMEOUT) return "timeout"
    if (code === GLOC_DENIED || code === GLOC_RESTRICTED) return "denied"
    return "unavailable"
}

// Indoor and laptop GPS often times out at high accuracy; a coarse fix is still useful.
const withFallback = async (
    attempt: (options: PositionOptions) => Promise<PositionResult>,
): Promise<PositionResult> => {
    const first = await attempt(HIGH_ACCURACY)
    // A denied permission stays denied, so retrying would only re-prompt.
    if ("fix" in first || first.error === "denied") return first
    return attempt(LOW_ACCURACY)
}

const webRun = (): Promise<PositionResult> => withFallback(webPosition)

const nativeRun = async (): Promise<PositionResult> => {
    try {
        const { Geolocation } = await import("@capacitor/geolocation")
        const permission = await Geolocation.requestPermissions()
        if (permission.location === "denied") return { error: "denied" }
        const attempt = async (options: PositionOptions): Promise<PositionResult> => {
            try {
                const position = await Geolocation.getCurrentPosition(options)
                return { fix: fixOf(position.coords) }
            } catch (error) {
                return { error: nativeError(error) }
            }
        }
        return withFallback(attempt)
    } catch (error) {
        return { error: nativeError(error) }
    }
}

const withWatchdog = (run: () => Promise<PositionResult>): Promise<PositionResult> =>
    new Promise((resolve) => {
        let settled = false
        let timer: ReturnType<typeof setTimeout>
        const settle = (result: PositionResult) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(result)
        }
        timer = setTimeout(() => settle({ error: "timeout" }), FIX_WATCHDOG_MS)
        run().then(settle, () => settle({ error: "unavailable" }))
    })

/** Current device position; resolves with a typed error rather than rejecting. */
export const getCurrentPosition = (): Promise<PositionResult> =>
    withWatchdog(() => (isNative() ? nativeRun() : webRun()))
